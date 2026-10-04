import { create } from "zustand";
import type { PredictionItem } from "../api/predict";

export type ScreenType = "landing" | "scan";
export type CameraState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

interface AppState {
  currentScreen: ScreenType;
  cameraState: CameraState;
  isScanning: boolean;
  isLaunching: boolean;
  currentPrediction: PredictionItem[];
  bbox: [number, number, number, number] | null;
  confidence: number;
  isMuted: boolean;

  // Actions
  setScreen: (screen: ScreenType) => void;
  setCameraState: (state: CameraState) => void;
  setIsScanning: (isScanning: boolean) => void;
  setIsLaunching: (isLaunching: boolean) => void;
  setPrediction: (
    predictions: PredictionItem[],
    bbox: [number, number, number, number] | null,
    confidence?: number
  ) => void;
  toggleMute: () => void;
  resetScan: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "landing",
  cameraState: "idle",
  isScanning: false,
  isLaunching: false,
  currentPrediction: [],
  bbox: null,
  confidence: 0,
  isMuted: false,

  setScreen: (currentScreen) => set({ currentScreen }),
  setCameraState: (cameraState) => set({ cameraState }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsLaunching: (isLaunching) => set({ isLaunching }),
  setPrediction: (currentPrediction, bbox, confidence = 0) =>
    set({
      currentPrediction,
      bbox,
      confidence:
        confidence ||
        (currentPrediction[0] ? currentPrediction[0].confidence : 0),
    }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  resetScan: () =>
    set({
      isScanning: false,
      isLaunching: false,
      currentPrediction: [],
      bbox: null,
      confidence: 0,
    }),
}));
