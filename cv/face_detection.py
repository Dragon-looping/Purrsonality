import cv2


def main():
    # Open default webcam (device index 0)
    cap = cv2.VideoCapture(0)

    # Check whether the webcam opened successfully
    if not cap.isOpened():
        print("Error: Could not open webcam.", flush=True)
        return

    print("Webcam opened successfully. Press 'q' to close the camera window.", flush=True)

    while True:
        # Continuously read frames from the webcam
        ret, frame = cap.read()

        # If a frame could not be captured, break out of the loop
        if not ret:
            print("Error: Failed to read frame from webcam.", flush=True)
            break

        # Display the live camera feed in an OpenCV window
        cv2.imshow("Purrsonality - Webcam Test", frame)

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
