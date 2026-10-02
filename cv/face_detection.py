import cv2


def main():
    # Load OpenCV's pre-trained Haar Cascade frontal-face classifier
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    # Verify that the cascade classifier loaded successfully
    if face_cascade.empty():
        print(f"Error: Failed to load Haar Cascade from {cascade_path}", flush=True)
        return

    # Open default webcam (device index 0)
    cap = cv2.VideoCapture(0)

    # Check whether the webcam opened successfully
    if not cap.isOpened():
        print("Error: Could not open webcam.", flush=True)
        return

    print("Webcam and face detector initialized successfully. Press 'q' to close.", flush=True)

    while True:
        # Continuously read frames from the webcam
        ret, frame = cap.read()

        # If a frame could not be captured, break out of the loop
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        # Convert frame from BGR to grayscale for Haar Cascade detection
        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect faces in the grayscale frame
        # scaleFactor compensates for faces appearing bigger or smaller
        # minNeighbors specifies how many neighbors each candidate rectangle should retain
        faces = face_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
        )

        # Draw a green rectangle around every detected face
        # (0, 255, 0) represents Green in BGR color format
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        # Display the number of detected faces on the video frame
        face_count_text = f"Faces Detected: {len(faces)}"
        cv2.putText(
            frame,
            face_count_text,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        # Display the live camera feed with detections in an OpenCV window
        cv2.imshow("Purrsonality - Face Detection", frame)

        # Allow user to press 'q' to close the camera window safely
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Closing webcam window...", flush=True)
            break

    # Release the webcam resource
    cap.release()

    # Destroy and clean up all OpenCV windows
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
