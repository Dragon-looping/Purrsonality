import os
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarksConnections

# Official Google storage URL for the MediaPipe Face Landmarker model bundle
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)


def get_model_path() -> str:
    """
    Resolves the portable path to the MediaPipe Face Landmarker model.
    The path is computed relative to the project directory (models/face_landmarker.task),
    ensuring no machine-specific absolute paths are hardcoded.
    If the model file does not exist, it is automatically downloaded.
    """
    project_root = Path(__file__).resolve().parent.parent
    model_dir = project_root / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "face_landmarker.task"

    if not model_path.exists():
        print(f"Downloading face_landmarker.task from {MODEL_URL}...", flush=True)
        urllib.request.urlretrieve(MODEL_URL, str(model_path))
        print("Model download complete.", flush=True)

    return str(model_path)


def draw_landmarks(frame, detection_result):
    """
    Draws facial landmarks and structural contours onto the video frame.

    What facial landmarks represent:
    MediaPipe Face Landmarker estimates 478 3D facial landmarks (468 facial mesh
    points covering the face oval, lips, eyes, eyebrows, and nose, plus 10 iris points).
    Each landmark contains:
    - x: Normalized coordinate in [0.0, 1.0] across image width.
    - y: Normalized coordinate in [0.0, 1.0] across image height.
    - z: Relative landmark depth with the center of the head as origin.

    How the landmarks are drawn:
    1. Landmark normalized (x, y) coordinates are converted to pixel positions by
       multiplying with the frame's width and height.
    2. Structural contours (eyes, lips, face oval, eyebrows) are connected using lines
       (cv2.line) defined in FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS.
    3. Individual landmark points are rendered as small green dots (cv2.circle).
    """
    height, width, _ = frame.shape

    if not detection_result.face_landmarks:
        return

    for face_landmarks in detection_result.face_landmarks:
        # Convert normalized float coordinates [0, 1] to pixel coordinates (x, y)
        pixel_points = [
            (int(landmark.x * width), int(landmark.y * height))
            for landmark in face_landmarks
        ]

        # Draw structural facial contour lines (eyes, eyebrows, lips, face oval)
        for connection in FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS:
            start_idx = connection.start
            end_idx = connection.end
            if start_idx < len(pixel_points) and end_idx < len(pixel_points):
                cv2.line(
                    frame,
                    pixel_points[start_idx],
                    pixel_points[end_idx],
                    (0, 255, 255),  # Yellow contour lines
                    1,
                    cv2.LINE_AA,
                )

        # Draw individual landmark keypoints as small green dots
        for point in pixel_points:
            cv2.circle(frame, point, 1, (0, 255, 0), -1)


def main():
    # 1. Resolve and verify the Face Landmarker model path
    model_path = get_model_path()

    # 2. Configure MediaPipe Tasks Face Landmarker
    # MediaPipe 1.0+ uses BaseOptions with model_asset_path to load .task models
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

    # 3. Open webcam stream using OpenCV
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.", flush=True)
        landmarker.close()
        return

    print("MediaPipe Face Landmarker initialized. Press 'q' to quit.", flush=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        # Why the webcam frame is converted:
        # OpenCV captures frames in BGR (Blue, Green, Red) format as NumPy arrays.
        # MediaPipe Tasks expects RGB (Red, Green, Blue) images wrapped inside
        # an mp.Image object with ImageFormat.SRGB.
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # How MediaPipe processes the frame:
        # landmarker.detect() runs inference using TensorFlow Lite models bundled
        # in face_landmarker.task: first detecting the face bounding box, then
        # predicting the 478 3D landmark coordinates and blendshapes.
        detection_result = landmarker.detect(mp_image)

        # Draw the detected landmarks and contours on the video frame
        draw_landmarks(frame, detection_result)

        # Display detection status overlay
        face_count = len(detection_result.face_landmarks) if detection_result.face_landmarks else 0
        status_text = f"Faces: {face_count} | Landmarks: {478 if face_count > 0 else 0}"
        cv2.putText(
            frame,
            status_text,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        # Display the live annotated frame in an OpenCV window
        cv2.imshow("Purrsonality - Facial Landmarks", frame)

        # Press 'q' to safely exit the loop
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Closing application...", flush=True)
            break

    # Clean up and release all resources
    cap.release()
    landmarker.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
