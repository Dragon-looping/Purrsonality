import { create } from "zustand";
import type { PredictResponse, Prediction } from "../api/predict";

export type ScreenType = "landing" | "scan";
export type CameraState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";
export type BackendStatus = "checking" | "online" | "offline";

interface AppState {
  currentScreen: ScreenType;
  cameraState: CameraState;
  backendStatus: BackendStatus;
  isAnalyzing: boolean;
  isScanning: boolean;
  isLaunching: boolean;
  isMuted: boolean;
  capturedImage: string | null;
  predictResult: PredictResponse | null;
  scanError: string | null;

  // Actions
  setScreen: (screen: ScreenType) => void;
  setCameraState: (state: CameraState) => void;
  setBackendStatus: (status: BackendStatus) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setIsScanning: (isScanning: boolean) => void;
  setIsLaunching: (isLaunching: boolean) => void;
  setCapturedImage: (capturedImage: string | null) => void;
  setPredictResult: (predictResult: PredictResponse | null) => void;
  setScanError: (scanError: string | null) => void;
  toggleMute: () => void;
  resetScan: () => void;

  // Backward compatibility getters
  currentPrediction: Prediction[];
  bbox: [number, number, number, number] | null;
  confidence: number;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "landing",
  cameraState: "idle",
  backendStatus: "checking",
  isAnalyzing: false,
  isScanning: false,
  isLaunching: false,
  isMuted: false,
  capturedImage: null,
  predictResult: null,
  scanError: null,
  currentPrediction: [],
  bbox: null,
  confidence: 0,

  setScreen: (currentScreen) => set({ currentScreen }),
  setCameraState: (cameraState) => set({ cameraState }),
  setBackendStatus: (backendStatus) => set({ backendStatus }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing, isScanning: isAnalyzing }),
  setIsScanning: (isScanning) => set({ isScanning, isAnalyzing: isScanning }),
  setIsLaunching: (isLaunching) => set({ isLaunching }),
  setCapturedImage: (capturedImage) => set({ capturedImage }),
  setPredictResult: (predictResult) => {
    const firstPred = predictResult?.predictions?.[0];
    set({
      predictResult,
      currentPrediction: predictResult?.predictions || [],
      bbox: predictResult?.bbox || null,
      confidence: firstPred?.confidence || 0,
      scanError: null,
    });
  },
  setScanError: (scanError) => set({ scanError }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  resetScan: () =>
    set({
      isAnalyzing: false,
      isScanning: false,
      capturedImage: null,
      predictResult: null,
      scanError: null,
      currentPrediction: [],
      bbox: null,
      confidence: 0,
    }),
}));
