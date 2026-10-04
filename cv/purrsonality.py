"""
Purrsonality - End-to-End Real-Time Computer Vision Pipeline.

Pipeline Architecture:
    Webcam (OpenCV)
        ↓
    MediaPipe Face Landmarks (478 3D Mesh)
        ↓
    Facial Feature Measurements (EAR, MAR, Mouth Width, Smile)
        ↓
    Rule-Based Expression Classification (Neutral, Happy, Surprised, Eyes Closed)
        ↓
    Real Local Cat-Meme Matching (assets/memes/...)
        ↓
    Side-by-Side Live Display (Webcam + Matched Cat Meme Card)
"""

import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Reuse existing modules without duplicating logic
from cv.facial_features import (
    LEFT_EYE_BOTTOM_1,
    LEFT_EYE_BOTTOM_2,
    LEFT_EYE_CORNER_INNER,
    LEFT_EYE_CORNER_OUTER,
    LEFT_EYE_TOP_1,
    LEFT_EYE_TOP_2,
    REF_EYE_OUTER_LEFT,
    REF_EYE_OUTER_RIGHT,
    RIGHT_EYE_BOTTOM_1,
    RIGHT_EYE_BOTTOM_2,
    RIGHT_EYE_CORNER_INNER,
    RIGHT_EYE_CORNER_OUTER,
    RIGHT_EYE_TOP_1,
    RIGHT_EYE_TOP_2,
    calculate_ear,
    calculate_mar,
    calculate_mouth_width,
    calculate_smile_measurement,
    draw_landmarks,
    euclidean_distance,
    get_model_path,
    get_pixel_landmarks,
)
from cv.expression_classifier import (
    EXPRESSION_COLORS,
    STATE_EYES_CLOSED,
    STATE_HAPPY,
    STATE_NEUTRAL,
    STATE_SURPRISED,
    classify_expression,
)
from cv.cat_matcher import match_cat


# ==============================================================================
# Visual HUD & Meme Panel Rendering
# ==============================================================================

def draw_webcam_hud(
    frame: np.ndarray,
    expression: str,
    features: Optional[Dict[str, float]],
    cat_meme: Dict[str, Any],
    fps: float,
) -> None:
    """
    Renders an informative HUD overlay directly onto the webcam frame displaying:
    - Detected Expression
    - Current FPS
    - Matched Cat Name
    - Cat Caption
    - EAR, MAR, Mouth Width, and Smile metrics
    """
    box_x, box_y, box_w, box_h = 12, 12, 380, 240
    overlay = frame.copy()

    # Translucent dark backing card
    cv2.rectangle(overlay, (box_x, box_y), (box_x + box_w, box_y + box_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.70, frame, 0.30, 0, frame)
    cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (75, 75, 75), 1)

    # 1. Expression Banner & FPS
    expr_color = EXPRESSION_COLORS.get(expression, (200, 200, 200))
    cv2.putText(
        frame,
        f"{expression.upper()}",
        (box_x + 12, box_y + 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        expr_color,
        2,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        f"FPS: {fps:.1f}",
        (box_x + box_w - 95, box_y + 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.50,
        (0, 255, 255),
        1,
        cv2.LINE_AA,
    )

    # 2. Cat Name & Caption
    cat_name = cat_meme.get("cat_name", "None")
    caption = cat_meme.get("caption", "")
    cv2.putText(
        frame,
        f"Cat: {cat_name}",
        (box_x + 12, box_y + 55),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.52,
        (255, 220, 100),
        1,
        cv2.LINE_AA,
    )

    # Truncate caption if very long for HUD display
    display_caption = caption if len(caption) <= 42 else caption[:39] + "..."
    cv2.putText(
        frame,
        f'"{display_caption}"',
        (box_x + 12, box_y + 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (190, 190, 190),
        1,
        cv2.LINE_AA,
    )

    cv2.line(
        frame,
        (box_x + 10, box_y + 85),
        (box_x + box_w - 10, box_y + 85),
        (60, 60, 60),
        1,
    )

    # 3. Geometric Metrics Readout
    if features is None:
        cv2.putText(
            frame,
            "Face Status: No face detected",
            (box_x + 12, box_y + 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (0, 120, 255),
            1,
            cv2.LINE_AA,
        )
        metric_lines = [
            ("EAR Average:", "N/A"),
            ("MAR (Mouth):", "N/A"),
            ("Mouth Width:", "N/A"),
            ("Smile Measure:", "N/A"),
        ]
    else:
        metric_lines = [
            ("EAR Average:", f"{features['ear_avg']:.3f}"),
            ("MAR (Mouth):", f"{features['mar']:.3f}"),
            ("Mouth Width:", f"{features['mouth_width']:.3f} (norm)"),
            ("Smile Measure:", f"{features['smile']:+.3f}"),
        ]

    start_y = box_y + 115
    for label, val in metric_lines:
        cv2.putText(
            frame,
            f"{label:<16} {val}",
            (box_x + 12, start_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (240, 240, 240),
            1,
            cv2.LINE_AA,
        )
        start_y += 24

    # Quit prompt
    cv2.putText(
        frame,
        "Press 'q' to quit",
        (box_x + 12, box_y + box_h - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.38,
        (130, 130, 130),
        1,
        cv2.LINE_AA,
    )


def create_meme_panel(
    panel_h: int,
    panel_w: int,
    cat_meme: Dict[str, Any],
    expression: str,
) -> np.ndarray:
    """
    Renders a dedicated side-by-side card displaying the matched cat meme image,
    title, and full caption with aspect-ratio preservation and fallback handling.
    """
    panel = np.full((panel_h, panel_w, 3), 22, dtype=np.uint8)

    # Header section
    expr_color = EXPRESSION_COLORS.get(expression, (200, 200, 200))
    cv2.putText(
        panel,
        "MATCHED CAT MEME",
        (20, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.68,
        (0, 255, 255),
        2,
        cv2.LINE_AA,
    )

    cat_name = cat_meme.get("cat_name", "Unknown Cat")
    cv2.putText(
        panel,
        f"{cat_name} ({expression})",
        (20, 58),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        expr_color,
        1,
        cv2.LINE_AA,
    )

    # Image canvas boundaries
    avail_w = panel_w - 40
    avail_h = panel_h - 150
    start_y = 75

    img_path = cat_meme.get("image_path")
    loaded_img = None
    if img_path:
        # Load local image (.jpg, .jpeg, .png, or .webp)
        full_path = PROJECT_ROOT / img_path if not Path(img_path).is_absolute() else Path(img_path)
        if full_path.exists():
            loaded_img = cv2.imread(str(full_path))

    if loaded_img is not None:
        # Scale with aspect-ratio preservation
        orig_h, orig_w, _ = loaded_img.shape
        scale = min(avail_w / orig_w, avail_h / orig_h)
        new_w, new_h = max(1, int(orig_w * scale)), max(1, int(orig_h * scale))
        resized = cv2.resize(loaded_img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        # Center in available box
        offset_x = 20 + (avail_w - new_w) // 2
        offset_y = start_y + (avail_h - new_h) // 2
        panel[offset_y : offset_y + new_h, offset_x : offset_x + new_w] = resized

        # Subtle frame border around image
        cv2.rectangle(
            panel,
            (offset_x - 1, offset_y - 1),
            (offset_x + new_w + 1, offset_y + new_h + 1),
            (70, 70, 70),
            1,
        )
    else:
        # Fallback card when no face is present or image failed to load
        cv2.rectangle(
            panel,
            (20, start_y),
            (panel_w - 20, start_y + avail_h),
            (35, 35, 35),
            -1,
        )
        cv2.rectangle(
            panel,
            (20, start_y),
            (panel_w - 20, start_y + avail_h),
            (60, 60, 60),
            1,
        )
        msg_1 = "No Face in View" if expression == "No Face" else "Image Unavailable"
        msg_2 = "Step in front of the camera!" if expression == "No Face" else "Could not load meme file"
        cv2.putText(
            panel,
            msg_1,
            (panel_w // 2 - 95, start_y + avail_h // 2 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (180, 180, 180),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            panel,
            msg_2,
            (panel_w // 2 - 115, start_y + avail_h // 2 + 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (130, 130, 130),
            1,
            cv2.LINE_AA,
        )

    # Caption footer (wrap into 2 lines if needed)
    caption = cat_meme.get("caption", "")
    line_limit = 44
    if len(caption) <= line_limit:
        cv2.putText(
            panel,
            caption,
            (20, panel_h - 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (210, 210, 210),
            1,
            cv2.LINE_AA,
        )
    else:
        split_idx = caption[:line_limit].rfind(" ")
        if split_idx == -1:
            split_idx = line_limit
        line1 = caption[:split_idx]
        line2 = caption[split_idx:].strip()
        cv2.putText(
            panel,
            line1,
            (20, panel_h - 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.44,
            (210, 210, 210),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            panel,
            line2,
            (20, panel_h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.44,
            (210, 210, 210),
            1,
            cv2.LINE_AA,
        )

    return panel


# ==============================================================================
# Complete Purrsonality CV Pipeline
# ==============================================================================

def run_pipeline():
    """Runs the continuous Purrsonality pipeline from webcam feed."""
    # 1. Initialize MediaPipe Face Landmarker
    model_path = get_model_path()
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    landmarker = vision.FaceLandmarker.create_from_options(options)

    # 2. Open Webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open default webcam.", flush=True)
        landmarker.close()
        return

    print("Purrsonality CV Pipeline running. Press 'q' to exit.", flush=True)

    # State tracking to avoid meme flickering while expression stays constant
    last_expression: Optional[str] = None
    current_cat_meme: Dict[str, Any] = match_cat("No Face")

    prev_frame_time = time.time()
    fps_smooth = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        # Calculate FPS with simple exponential smoothing
        curr_time = time.time()
        dt = curr_time - prev_frame_time
        prev_frame_time = curr_time
        instant_fps = (1.0 / dt) if dt > 0.0 else 0.0
        fps_smooth = (0.9 * fps_smooth + 0.1 * instant_fps) if fps_smooth > 0.0 else instant_fps

        frame_h, frame_w, _ = frame.shape

        # Step 1: MediaPipe Face Landmarking
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        detection_result = landmarker.detect(mp_image)

        # Draw full facial mesh overlay
        draw_landmarks(frame, detection_result)

        features = None
        expression = "No Face"

        # Step 2: Facial Feature Extraction & Expression Classification
        if detection_result.face_landmarks and len(detection_result.face_landmarks) > 0:
            pts = get_pixel_landmarks(detection_result.face_landmarks[0], frame_w, frame_h)

            ear_left = calculate_ear(
                pts,
                LEFT_EYE_CORNER_INNER,
                LEFT_EYE_CORNER_OUTER,
                LEFT_EYE_TOP_1,
                LEFT_EYE_BOTTOM_1,
                LEFT_EYE_TOP_2,
                LEFT_EYE_BOTTOM_2,
            )
            ear_right = calculate_ear(
                pts,
                RIGHT_EYE_CORNER_OUTER,
                RIGHT_EYE_CORNER_INNER,
                RIGHT_EYE_TOP_1,
                RIGHT_EYE_BOTTOM_1,
                RIGHT_EYE_TOP_2,
                RIGHT_EYE_BOTTOM_2,
            )
            ear_avg = (ear_left + ear_right) / 2.0

            iod = euclidean_distance(pts[REF_EYE_OUTER_RIGHT], pts[REF_EYE_OUTER_LEFT])
            mar = calculate_mar(pts)
            mouth_width = calculate_mouth_width(pts, ref_distance=iod)
            smile = calculate_smile_measurement(pts, ref_distance=iod)

            features = {
                "ear_left": ear_left,
                "ear_right": ear_right,
                "ear_avg": ear_avg,
                "mar": mar,
                "mouth_width": mouth_width,
                "smile": smile,
            }

            expression = classify_expression(features)

        # Step 3: Cat-Meme Matching (Update meme when expression changes to prevent flickering)
        if expression != last_expression:
            last_expression = expression
            current_cat_meme = match_cat(expression)

        # Step 4: Draw Webcam HUD Overlay
        draw_webcam_hud(frame, expression, features, current_cat_meme, fps_smooth)

        # Step 5: Render Side-by-Side Meme Panel
        # Width: 460px, Height: matches webcam frame height
        meme_panel = create_meme_panel(frame_h, 460, current_cat_meme, expression)

        # Combine webcam and meme card horizontally
        combined_display = np.hstack([frame, meme_panel])

        # Display composite window
        cv2.imshow("Purrsonality - AI Cat Meme Matcher", combined_display)

        # Press Q to safely exit
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Exiting Purrsonality pipeline...", flush=True)
            break

    # Clean up resources
    cap.release()
    landmarker.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_pipeline()
