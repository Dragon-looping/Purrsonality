import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Ensure project root is in sys.path so cv module imports work smoothly
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from cv.face_landmarks import draw_landmarks, get_model_path
except ImportError:
    from face_landmarks import draw_landmarks, get_model_path


# ==============================================================================
# Landmark Indices Constants (MediaPipe 478-Point Face Mesh)
# ==============================================================================

# Left Eye (Subject's anatomical left, appears on the right side of the image)
# Standard 6-point EAR configuration:
# - Inner and outer corners: medial canthus (362), lateral canthus (263)
# - Vertical opposing eyelid pairs: (385, 380) and (387, 373)
LEFT_EYE_CORNER_INNER = 362
LEFT_EYE_CORNER_OUTER = 263
LEFT_EYE_TOP_1 = 385
LEFT_EYE_BOTTOM_1 = 380
LEFT_EYE_TOP_2 = 387
LEFT_EYE_BOTTOM_2 = 373

# Right Eye (Subject's anatomical right, appears on the left side of the image)
# Standard 6-point EAR configuration:
# - Inner and outer corners: medial canthus (133), lateral canthus (33)
# - Vertical opposing eyelid pairs: (160, 144) and (158, 153)
RIGHT_EYE_CORNER_OUTER = 33
RIGHT_EYE_CORNER_INNER = 133
RIGHT_EYE_TOP_1 = 160
RIGHT_EYE_BOTTOM_1 = 144
RIGHT_EYE_TOP_2 = 158
RIGHT_EYE_BOTTOM_2 = 153

# Inter-Ocular Reference Points (for scale normalization across varying camera distances)
# Distance between the two outer eye corners serves as a robust anthropometric scale baseline.
REF_EYE_OUTER_RIGHT = RIGHT_EYE_CORNER_OUTER  # 33
REF_EYE_OUTER_LEFT = LEFT_EYE_CORNER_OUTER   # 263

# Mouth Corners (Outer lip corners for mouth width and smile elevation)
MOUTH_CORNER_RIGHT = 61   # Subject's right corner
MOUTH_CORNER_LEFT = 291   # Subject's left corner

# Inner Mouth Landmarks (For Mouth Aspect Ratio - MAR mouth aperture)
# - Inner corner horizontal endpoints: (78, 308)
# - Vertical inner opposing pairs: (81, 178) and (311, 402)
MOUTH_INNER_CORNER_RIGHT = 78
MOUTH_INNER_CORNER_LEFT = 308
MOUTH_INNER_TOP_1 = 81
MOUTH_INNER_BOTTOM_1 = 178
MOUTH_INNER_TOP_2 = 311
MOUTH_INNER_BOTTOM_2 = 402

# Lip Center Reference Landmark (For smile corner elevation measurement)
UPPER_LIP_CENTER = 0  # Upper boundary center of the top lip


# ==============================================================================
# Geometric Calculation Functions
# ==============================================================================

def euclidean_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Calculates the 2D Euclidean distance between two points."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def get_pixel_landmarks(
    face_landmarks, image_width: int, image_height: int
) -> List[Tuple[float, float]]:
    """Converts normalized [0, 1] landmark coordinates into 2D pixel coordinates."""
    return [
        (lm.x * image_width, lm.y * image_height)
        for lm in face_landmarks
    ]


def calculate_ear(
    pts: List[Tuple[float, float]],
    corner_a_idx: int,
    corner_b_idx: int,
    top_1_idx: int,
    bottom_1_idx: int,
    top_2_idx: int,
    bottom_2_idx: int,
) -> float:
    """
    Calculates the Eye Aspect Ratio (EAR) based on Soukupova & Cech (2016).

    Mathematical Formulation:
        EAR = (||p_top1 - p_bottom1|| + ||p_top2 - p_bottom2||)
              / (2.0 * ||p_corner_a - p_corner_b||)

    Rationale:
    - The numerator measures the sum of two vertical spans across the eyelid opening.
    - The denominator measures twice the horizontal span between inner and outer eye corners.
    - Because both numerator and denominator scale linearly with face size / camera distance,
      the resulting ratio is dimensionless and scale-invariant.
    - An open eye typically produces an EAR of 0.25 - 0.38, whereas a closed or blinking
      eye drops sharply below 0.18 - 0.20.
    """
    vertical_1 = euclidean_distance(pts[top_1_idx], pts[bottom_1_idx])
    vertical_2 = euclidean_distance(pts[top_2_idx], pts[bottom_2_idx])
    horizontal = euclidean_distance(pts[corner_a_idx], pts[corner_b_idx])

    if horizontal == 0.0:
        return 0.0
    return (vertical_1 + vertical_2) / (2.0 * horizontal)


def calculate_mar(
    pts: List[Tuple[float, float]],
    corner_a_idx: int = MOUTH_INNER_CORNER_RIGHT,
    corner_b_idx: int = MOUTH_INNER_CORNER_LEFT,
    top_1_idx: int = MOUTH_INNER_TOP_1,
    bottom_1_idx: int = MOUTH_INNER_BOTTOM_1,
    top_2_idx: int = MOUTH_INNER_TOP_2,
    bottom_2_idx: int = MOUTH_INNER_BOTTOM_2,
) -> float:
    """
    Calculates the Mouth Aspect Ratio (MAR) to measure mouth opening/aperture.

    Mathematical Formulation:
        MAR = (||p_top1 - p_bottom1|| + ||p_top2 - p_bottom2||)
              / (2.0 * ||p_corner_a - p_corner_b||)

    Rationale:
    - Mirrors the EAR formula by evaluating vertical separation across the inner lip opening
      relative to the horizontal width between inner mouth corners.
    - Using inner lip points ensures that when the lips are closed, the vertical distance is
      near 0.0 (resulting in MAR ~ 0.00 - 0.03).
    - When the mouth is opened (e.g. talking, yawning, smiling with teeth), the vertical opening
      expands, causing MAR to rise to 0.20 - 0.70+.
    """
    vertical_1 = euclidean_distance(pts[top_1_idx], pts[bottom_1_idx])
    vertical_2 = euclidean_distance(pts[top_2_idx], pts[bottom_2_idx])
    horizontal = euclidean_distance(pts[corner_a_idx], pts[corner_b_idx])

    if horizontal == 0.0:
        return 0.0
    return (vertical_1 + vertical_2) / (2.0 * horizontal)


def calculate_mouth_width(
    pts: List[Tuple[float, float]],
    corner_right_idx: int = MOUTH_CORNER_RIGHT,
    corner_left_idx: int = MOUTH_CORNER_LEFT,
    ref_distance: Optional[float] = None,
) -> float:
    """
    Calculates the distance between the left and right corners of the mouth.

    Normalization:
    - If ref_distance (inter-ocular distance) is provided, the mouth width is normalized
      as (mouth_width / ref_distance). This provides a resolution- and distance-independent ratio.
    - Typical neutral values range around 0.45 - 0.55 of inter-ocular distance, expanding
      up to 0.65 - 0.75+ when smiling broadly.
    """
    width = euclidean_distance(pts[corner_right_idx], pts[corner_left_idx])
    if ref_distance and ref_distance > 0.0:
        return width / ref_distance
    return width


def calculate_smile_measurement(
    pts: List[Tuple[float, float]],
    corner_right_idx: int = MOUTH_CORNER_RIGHT,
    corner_left_idx: int = MOUTH_CORNER_LEFT,
    center_lip_idx: int = UPPER_LIP_CENTER,
    ref_distance: Optional[float] = None,
) -> float:
    """
    Calculates a geometric smile measurement based on mouth corner elevation.

    Mathematical Formulation:
        Corner Elevation = (y_upper_lip_center - ((y_right_corner + y_left_corner) / 2))
                           / ref_distance

    Rationale:
    - In image coordinates, the Y axis points downward (smaller Y = higher on face).
    - When smiling, the zygomaticus major muscle contracts, pulling the mouth corners
      laterally and UPWARD towards the cheekbones.
    - Under a neutral expression, the corners lie at or below the upper lip midline
      (resulting in elevation ~ 0.0 or slightly negative).
    - Under a smile, the corners rise above the lip center, producing a positive elevation.
    - Dividing by ref_distance (inter-ocular distance) renders the metric scale-invariant.
    """
    corner_y_avg = (pts[corner_right_idx][1] + pts[corner_left_idx][1]) / 2.0
    lip_center_y = pts[center_lip_idx][1]

    # In pixel space, upward motion decreases Y, so (lip_center_y - corner_y_avg) is positive when corners are raised
    elevation = lip_center_y - corner_y_avg

    if ref_distance and ref_distance > 0.0:
        return elevation / ref_distance
    return elevation


# ==============================================================================
# Visualization Overlay Helper
# ==============================================================================

def draw_metrics_overlay(frame, metrics: Optional[Dict[str, Optional[float]]]) -> None:
    """
    Draws a translucent HUD card on the video frame displaying the live
    facial feature metrics or a 'No face detected' status.
    """
    # Create translucent dark background banner for maximum contrast and readability
    overlay = frame.copy()
    box_x, box_y, box_w, box_h = 15, 15, 330, 205
    cv2.rectangle(
        overlay,
        (box_x, box_y),
        (box_x + box_w, box_y + box_h),
        (20, 20, 20),
        -1,
    )
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.rectangle(
        frame,
        (box_x, box_y),
        (box_x + box_w, box_y + box_h),
        (80, 80, 80),
        1,
    )

    # Title header
    cv2.putText(
        frame,
        "Facial Feature Metrics",
        (box_x + 12, box_y + 24),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (0, 255, 255),
        2,
        cv2.LINE_AA,
    )

    if metrics is None:
        # Case where no face is detected
        cv2.putText(
            frame,
            "Face Status: No face detected",
            (box_x + 12, box_y + 52),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 100, 255),  # Orange warning
            1,
            cv2.LINE_AA,
        )
        labels = [
            ("EAR Left:", "N/A"),
            ("EAR Right:", "N/A"),
            ("EAR Average:", "N/A"),
            ("MAR:", "N/A"),
            ("Mouth Width:", "N/A"),
            ("Smile Measurement:", "N/A"),
        ]
        start_y = box_y + 75
        for label, val_str in labels:
            cv2.putText(
                frame,
                f"{label:<18} {val_str}",
                (box_x + 12, start_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (170, 170, 170),
                1,
                cv2.LINE_AA,
            )
            start_y += 20
        return

    # Case where face is detected
    lines = [
        ("EAR Left:", f"{metrics['ear_left']:.3f}"),
        ("EAR Right:", f"{metrics['ear_right']:.3f}"),
        ("EAR Average:", f"{metrics['ear_avg']:.3f}"),
        ("MAR:", f"{metrics['mar']:.3f}"),
        ("Mouth Width:", f"{metrics['mouth_width']:.3f} (norm)"),
        ("Smile Measurement:", f"{metrics['smile']:+.3f}"),
    ]

    start_y = box_y + 52
    for label, val_str in lines:
        cv2.putText(
            frame,
            f"{label:<20} {val_str}",
            (box_x + 12, start_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (0, 255, 0),  # Bright green readout
            1,
            cv2.LINE_AA,
        )
        start_y += 24


# ==============================================================================
# Main Execution Pipeline
# ==============================================================================

def main():
    # 1. Resolve MediaPipe Face Landmarker model path
    model_path = get_model_path()

    # 2. Configure MediaPipe Face Landmarker
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

    # 3. Open webcam stream
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.", flush=True)
        landmarker.close()
        return

    print("Facial feature measurement pipeline active. Press 'q' to quit.", flush=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        height, width, _ = frame.shape

        # MediaPipe expects RGB format inside an mp.Image wrapper
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Run inference
        detection_result = landmarker.detect(mp_image)

        # Draw full facial landmarks visualization (reused from face_landmarks)
        draw_landmarks(frame, detection_result)

        metrics = None
        if detection_result.face_landmarks and len(detection_result.face_landmarks) > 0:
            # Extract 2D pixel coordinates for the detected face
            pts = get_pixel_landmarks(detection_result.face_landmarks[0], width, height)

            # 1. Eye Aspect Ratio (EAR)
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

            # Scale normalization baseline (Inter-Ocular Distance)
            iod = euclidean_distance(pts[REF_EYE_OUTER_RIGHT], pts[REF_EYE_OUTER_LEFT])

            # 2. Mouth Aspect Ratio (MAR)
            mar = calculate_mar(pts)

            # 3. Mouth Width (Normalized by inter-ocular distance)
            mouth_width = calculate_mouth_width(pts, ref_distance=iod)

            # 4. Smile-related geometric measurement (Normalized corner elevation)
            smile = calculate_smile_measurement(pts, ref_distance=iod)

            metrics = {
                "ear_left": ear_left,
                "ear_right": ear_right,
                "ear_avg": ear_avg,
                "mar": mar,
                "mouth_width": mouth_width,
                "smile": smile,
            }

        # Draw HUD overlay with metrics or 'No face detected'
        draw_metrics_overlay(frame, metrics)

        # Display output window
        cv2.imshow("Purrsonality - Facial Features", frame)

        # Exit safely when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Closing facial features application...", flush=True)
            break

    # Clean up resources
    cap.release()
    landmarker.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
