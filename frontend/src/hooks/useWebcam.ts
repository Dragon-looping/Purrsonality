import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useAppStore, type CameraState } from "../store/useAppStore";

export const CAMERA_MESSAGES = {
  denied: "Paws off? We need camera access.",
  unavailable: "The cat stole your webcam.",
  no_face: "Are you even there, human?",
  granted: "Camera locked and loaded. Purr-fect.",
} as const;

export function useWebcam() {
  const webcamRef = useRef<Webcam>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { cameraState, setCameraState } = useAppStore();

  const handleUserMedia = useCallback(() => {
    setCameraState("granted");
    setErrorMessage(null);
  }, [setCameraState]);

  const handleUserMediaError = useCallback(
    (error: string | DOMException) => {
      console.warn("Webcam error encountered:", error);
      const isDenied =
        typeof error !== "string" &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError");

      const newState: CameraState = isDenied ? "denied" : "unavailable";
      setCameraState(newState);
      setErrorMessage(
        isDenied ? CAMERA_MESSAGES.denied : CAMERA_MESSAGES.unavailable
      );
    },
    [setCameraState]
  );

  const captureFrame = useCallback((): string | null => {
    if (!webcamRef.current) return null;
    return webcamRef.current.getScreenshot();
  }, []);

  return {
    webcamRef,
    cameraState,
    errorMessage,
    handleUserMedia,
    handleUserMediaError,
    captureFrame,
  };
}
