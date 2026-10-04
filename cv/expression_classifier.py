import sys
from pathlib import Path
from typing import Dict, Optional

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Ensure project root is in sys.path so cv module imports work smoothly
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

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

# ==============================================================================
# Configuration: Rule-Based Expression Classifier Thresholds
#
# NOTE: This is a transparent HEURISTIC / RULE-BASED BASELINE based on geometric
# landmark ratios, NOT a trained machine-learning emotion model. It demonstrates
# deterministic thresholding on calibrated facial geometry.
# ==============================================================================

# Eye Aspect Ratio (EAR) threshold for detecting eye closure / blinking
# Resting open eyes typically measure ~0.22 - 0.38. When eyelids close,
# EAR drops sharply below this threshold.
EAR_CLOSED_THRESHOLD = 0.16

# Mouth Aspect Ratio (MAR) threshold for detecting an open mouth (Surprised)
# Resting closed lips yield MAR ~0.01 - 0.05. An open jaw/mouth aperture
# drives MAR above 0.18.
MAR_SURPRISE_THRESHOLD = 0.18

# Smile Thresholds:
# A smile causes the zygomaticus muscles to widen the mouth laterally and elevate
# the lip corners above the resting upper lip line.
# - SMILE_MOUTH_WIDTH_THRESHOLD: normalized mouth width relative to inter-ocular distance
# - SMILE_ELEVATION_THRESHOLD: normalized mouth corner height relative to upper lip center
SMILE_MOUTH_WIDTH_THRESHOLD = 0.56
SMILE_ELEVATION_THRESHOLD = -0.01

# States supported by this baseline heuristic classifier
STATE_NEUTRAL = "Neutral"
STATE_HAPPY = "Happy"
STATE_SURPRISED = "Surprised"
STATE_EYES_CLOSED = "Eyes Closed"


# ==============================================================================
# Expression Classification Function
# ==============================================================================

def classify_expression(features: Optional[Dict[str, float]]) -> str:
    """
    Classifies facial geometry into one of four baseline states:
    1. 'Eyes Closed'
    2. 'Surprised'
    3. 'Happy'
    4. 'Neutral'

    Classification Priority & Decision Rules:
    - Step 1 (Eyes Closed): If ear_avg < EAR_CLOSED_THRESHOLD, eyelid closure
      takes immediate precedence (blinking or eyes shut).
    - Step 2 (Surprised): If mar >= MAR_SURPRISE_THRESHOLD and the corners are not
      elevated in a smile, the wide open mouth indicates surprise.
    - Step 3 (Happy): If the mouth is stretched horizontally (mouth_width >= threshold)
      and/or the mouth corners are elevated above the resting baseline (smile >= threshold).
    - Step 4 (Neutral): Default resting state when no threshold triggers are met.
    """
    if features is None:
        return "No Face"

    ear_avg = features["ear_avg"]
    mar = features["mar"]
    mouth_width = features["mouth_width"]
    smile = features["smile"]

    # Rule 1: Closed eyes / blink override
    if ear_avg < EAR_CLOSED_THRESHOLD:
        return STATE_EYES_CLOSED

    # Rule 2: Open mouth without smile corner elevation
    if mar >= MAR_SURPRISE_THRESHOLD and smile < (SMILE_ELEVATION_THRESHOLD + 0.05):
        return STATE_SURPRISED

    # Rule 3: Smile detection (mouth widening and/or corner elevation)
    if (mouth_width >= SMILE_MOUTH_WIDTH_THRESHOLD and smile >= SMILE_ELEVATION_THRESHOLD) or (
        smile >= (SMILE_ELEVATION_THRESHOLD + 0.05)
    ):
        return STATE_HAPPY

    # Rule 4: Default resting baseline
    return STATE_NEUTRAL


# ==============================================================================
# Visual Overlay Rendering
# ==============================================================================

EXPRESSION_COLORS = {
    STATE_NEUTRAL: (220, 220, 220),       # Soft White / Gray
    STATE_HAPPY: (0, 255, 128),           # Vibrant Green
    STATE_SURPRISED: (0, 220, 255),       # Bright Yellow / Cyan
    STATE_EYES_CLOSED: (0, 140, 255),     # Orange
    "No Face": (100, 100, 255),           # Coral Red
}


def draw_expression_overlay(
    frame,
    expression: str,
    features: Optional[Dict[str, float]],
) -> None:
    """
    Renders an informative HUD panel on the webcam feed showing:
    - Large color-coded Expression readout
    - Classification mode label ('Rule-Based Heuristic Baseline')
    - Underlying live feature measurements alongside their active thresholds
    """
    box_x, box_y, box_w, box_h = 15, 15, 380, 235
    overlay = frame.copy()

    # Semi-transparent dark background card
    cv2.rectangle(overlay, (box_x, box_y), (box_x + box_w, box_y + box_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.70, frame, 0.30, 0, frame)
    cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (75, 75, 75), 1)

    # Expression Banner Title
    expr_color = EXPRESSION_COLORS.get(expression, (200, 200, 200))
    cv2.putText(
        frame,
        f"Expression: {expression.upper()}",
        (box_x + 12, box_y + 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        expr_color,
        2,
        cv2.LINE_AA,
    )

    # Subtitle indicating baseline heuristic classification
    cv2.putText(
        frame,
        "Method: Rule-Based Heuristic Baseline",
        (box_x + 12, box_y + 55),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (160, 160, 160),
        1,
        cv2.LINE_AA,
    )

    cv2.line(
        frame,
        (box_x + 12, box_y + 65),
        (box_x + box_w - 12, box_y + 65),
        (60, 60, 60),
        1,
    )

    if features is None:
        cv2.putText(
            frame,
            "Face Status: No face detected in frame",
            (box_x + 12, box_y + 95),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (0, 100, 255),
            1,
            cv2.LINE_AA,
        )
        return

    # Metric lines showing current values and their corresponding decision thresholds
    readouts = [
        ("EAR Average:", f"{features['ear_avg']:.3f}", f"[Thresh: < {EAR_CLOSED_THRESHOLD:.2f}]"),
        ("MAR (Mouth):", f"{features['mar']:.3f}", f"[Thresh: >= {MAR_SURPRISE_THRESHOLD:.2f}]"),
        ("Mouth Width:", f"{features['mouth_width']:.3f} (norm)", f"[Thresh: >= {SMILE_MOUTH_WIDTH_THRESHOLD:.2f}]"),
        ("Smile Measure:", f"{features['smile']:+.3f}", f"[Thresh: >= {SMILE_ELEVATION_THRESHOLD:+.2f}]"),
    ]

    start_y = box_y + 95
    for label, val_str, thresh_str in readouts:
        cv2.putText(
            frame,
            f"{label:<15} {val_str}",
            (box_x + 12, start_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            thresh_str,
            (box_x + 235, start_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.40,
            (150, 200, 150),
            1,
            cv2.LINE_AA,
        )
        start_y += 28

    # Individual eye readouts at bottom
    cv2.putText(
        frame,
        f"Eyes: L={features['ear_left']:.2f} | R={features['ear_right']:.2f}",
        (box_x + 12, start_y + 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.44,
        (180, 180, 180),
        1,
        cv2.LINE_AA,
    )


# ==============================================================================
# Main Pipeline Loop
# ==============================================================================

def main():
    # 1. Resolve model and setup MediaPipe Face Landmarker
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

    # 2. Open webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.", flush=True)
        landmarker.close()
        return

    print("Rule-Based Expression Classifier active. Press 'q' to quit.", flush=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        height, width, _ = frame.shape

        # Convert OpenCV BGR to MediaPipe RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Run inference
        detection_result = landmarker.detect(mp_image)

        # Draw facial landmarks mesh
        draw_landmarks(frame, detection_result)

        features = None
        expression = "No Face"

        if detection_result.face_landmarks and len(detection_result.face_landmarks) > 0:
            pts = get_pixel_landmarks(detection_result.face_landmarks[0], width, height)

            # Extract geometric measurements
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

            # Classify expression using transparent rule heuristics
            expression = classify_expression(features)

        # Draw visual HUD overlay with classification and features
        draw_expression_overlay(frame, expression, features)

        # Display window
        cv2.imshow("Purrsonality - Expression Classifier", frame)

        # Safe exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Closing expression classifier...", flush=True)
            break

    # Resource cleanup
    cap.release()
    landmarker.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
