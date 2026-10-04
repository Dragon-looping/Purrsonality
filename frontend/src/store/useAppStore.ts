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

  // Step 16: Live Mode state
  liveMode: boolean;
  livePrediction: PredictResponse | null;
  liveLoading: boolean;
  bbox: [number, number, number, number] | null;
  lastPredictionTime: number | null;

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

  // Live Mode actions
  setLiveMode: (liveMode: boolean) => void;
  toggleLiveMode: () => void;
  setLivePrediction: (livePrediction: PredictResponse | null) => void;
  setLiveLoading: (liveLoading: boolean) => void;
  setBbox: (bbox: [number, number, number, number] | null) => void;
  setLastPredictionTime: (time: number | null) => void;

  // Backward compatibility getters
  currentPrediction: Prediction[];
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

  // Step 16 state defaults
  liveMode: false,
  livePrediction: null,
  liveLoading: false,
  bbox: null,
  lastPredictionTime: null,

  currentPrediction: [],
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
      livePrediction: null,
      liveLoading: false,
      bbox: null,
      currentPrediction: [],
      confidence: 0,
    }),

  // Live actions
  setLiveMode: (liveMode) =>
    set({
      liveMode,
      // If turning live mode off, clear live prediction and bbox
      ...(!liveMode ? { livePrediction: null, liveLoading: false, bbox: null } : {}),
    }),
  toggleLiveMode: () =>
    set((state) => ({
      liveMode: !state.liveMode,
      ...(!state.liveMode ? {} : { livePrediction: null, liveLoading: false, bbox: null }),
    })),
  setLivePrediction: (livePrediction) => {
    const firstPred = livePrediction?.predictions?.[0];
    set({
      livePrediction,
      bbox: livePrediction?.bbox || null,
      currentPrediction: livePrediction?.predictions || [],
      confidence: firstPred?.confidence || 0,
      lastPredictionTime: Date.now(),
    });
  },
  setLiveLoading: (liveLoading) => set({ liveLoading }),
  setBbox: (bbox) => set({ bbox }),
  setLastPredictionTime: (lastPredictionTime) => set({ lastPredictionTime }),
}));
