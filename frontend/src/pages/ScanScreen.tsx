import React, { useEffect, useState, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Camera,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Scan,
  Radio,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useWebcam } from "../hooks/useWebcam";
import {
  predictExpression,
  checkBackendHealth,
  getCatImageUrl,
  API_BASE_URL,
} from "../api/predict";
import { ROTATING_LOADING_MESSAGES } from "../config/theme";
import { ResultView } from "../components/ResultView";

export const ScanScreen: React.FC = () => {
  const {
    setScreen,
    cameraState,
    backendStatus,
    setBackendStatus,
    isAnalyzing,
    setIsAnalyzing,
    capturedImage,
    setCapturedImage,
    predictResult,
    setPredictResult,
    scanError,
    setScanError,
    resetScan,
    isFinalized,
    setIsFinalized,

    // Step 16 LIVE Mode state & actions
    liveMode,
    setLiveMode,
    livePrediction,
    setLivePrediction,
    liveLoading,
    setLiveLoading,
    bbox,
  } = useAppStore();

  const {
    webcamRef,
    errorMessage,
    handleUserMedia,
    handleUserMediaError,
    captureFrame,
  } = useWebcam();

  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [isLockingIn, setIsLockingIn] = useState(false);

  // References for live prediction loop lifecycle management
  const inFlightRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Poll backend health status periodically
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      const isOnline = await checkBackendHealth();
      if (isMounted) {
        setBackendStatus(isOnline ? "online" : "offline");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setBackendStatus]);

  // Rotate funny loading messages during prediction
  useEffect(() => {
    if (!isAnalyzing && !liveLoading) return;
    const interval = setInterval(() => {
      setLoadingPhraseIndex(
        (prev) => (prev + 1) % ROTATING_LOADING_MESSAGES.length
      );
    }, 700);
    return () => clearInterval(interval);
  }, [isAnalyzing, liveLoading]);

  // Track component unmount to ensure zero dangling requests or timers
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, []);

  // REAL LIVE Prediction Runner (Throttled to 500-700ms with strictly 1 in-flight)
  const runLiveIteration = useCallback(async () => {
    if (
      !isMountedRef.current ||
      !liveMode ||
      inFlightRef.current ||
      cameraState !== "granted" ||
      isFinalized
    ) {
      return;
    }

    const frame = captureFrame();
    if (!frame) return;

    inFlightRef.current = true;
    setLiveLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await predictExpression(frame, controller.signal);
      if (isMountedRef.current && liveMode && !isFinalized) {
        setLivePrediction(res);
        setBackendStatus("online");
        setScanError(null);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Request was aborted cleanly
      }
      if (isMountedRef.current && liveMode && !isFinalized) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("Failed to fetch") ||
          message.includes("NetworkError") ||
          message.includes("Load failed")
        ) {
          setBackendStatus("offline");
          setScanError("THE CAT UNPLUGGED THE SERVER.");
        }
      }
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setLiveLoading(false);
      }
    }
  }, [
    liveMode,
    cameraState,
    isFinalized,
    captureFrame,
    setLiveLoading,
    setLivePrediction,
    setBackendStatus,
    setScanError,
  ]);

  // LIVE loop schedule
  useEffect(() => {
    if (liveMode && cameraState === "granted" && !scanError && !isFinalized) {
      // Run first pass immediately
      runLiveIteration();

      // Schedule subsequent passes throttled to 600ms
      timerRef.current = window.setInterval(runLiveIteration, 600);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
      setLiveLoading(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [liveMode, cameraState, scanError, isFinalized, runLiveIteration, setLiveLoading]);

  // Return to scanner and reset state
  const handleScanAgain = useCallback(() => {
    setIsLockingIn(false);
    resetScan();
  }, [resetScan]);

  // Return to home landing page
  const handleBackToHome = useCallback(() => {
    setIsLockingIn(false);
    resetScan();
    setScreen("landing");
  }, [resetScan, setScreen]);

  // Lock in the live result and transition to polished Result View (Section 3 Hardening)
  const handleLockInLive = useCallback(() => {
    if (
      isLockingIn ||
      isFinalized ||
      !livePrediction ||
      !Array.isArray(livePrediction.predictions) ||
      livePrediction.predictions.length === 0
    ) {
      return;
    }

    setIsLockingIn(true);

    // Cancel active live intervals and in-flight requests immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    inFlightRef.current = false;

    const frame = captureFrame() || capturedImage;
    setCapturedImage(frame);
    setPredictResult(livePrediction);
    setIsFinalized(true);
  }, [
    isLockingIn,
    isFinalized,
    livePrediction,
    captureFrame,
    capturedImage,
    setCapturedImage,
    setPredictResult,
    setIsFinalized,
  ]);

  // SNAP action: captures one frame and requests single prediction from FastAPI
  const handleSnapAndPredict = useCallback(async () => {
    if (isAnalyzing || cameraState !== "granted" || isLockingIn) return;
    setScanError(null);

    const frame = captureFrame();
    if (!frame) {
      setScanError("Failed to capture image frame from webcam. Please try again.");
      return;
    }

    setCapturedImage(frame);
    setIsAnalyzing(true);

    try {
      const response = await predictExpression(frame);
      setPredictResult(response);
      if (response.predictions && response.predictions.length > 0) {
        setIsFinalized(true);
      }
    } catch (err: unknown) {
      console.error("Predict error:", err);
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("Load failed")
      ) {
        setScanError("THE CAT UNPLUGGED THE SERVER.");
      } else {
        setScanError(message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    isAnalyzing,
    cameraState,
    isLockingIn,
    captureFrame,
    setCapturedImage,
    setIsAnalyzing,
    setPredictResult,
    setIsFinalized,
    setScanError,
  ]);

  const hasValidLiveFace = Boolean(
    livePrediction &&
      Array.isArray(livePrediction.predictions) &&
      livePrediction.predictions.length > 0
  );

  const activeLivePrediction = livePrediction?.predictions?.[0];
  const liveCatImageUrl = getCatImageUrl(livePrediction?.cat);
  const isLiveNoFace = livePrediction && livePrediction.predictions.length === 0;

  // Frame dimension scaling for bounding box
  const frameWidth =
    livePrediction?.frame_size?.[0] ||
    webcamRef.current?.video?.videoWidth ||
    640;
  const frameHeight =
    livePrediction?.frame_size?.[1] ||
    webcamRef.current?.video?.videoHeight ||
    480;

  // Render logic for SNAP Mode
  const renderSnapContent = () => {
    // 1. Server Error
    if (scanError) {
      return (
        <motion.div
          key="server-error"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="py-12 px-4 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-5 rotate-[-3deg]">
            <AlertTriangle className="w-10 h-10 text-black" />
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl text-brand-pink tracking-wide mb-2">
            THE CAT UNPLUGGED THE SERVER.
          </h2>
          <p className="font-meme text-base sm:text-lg text-gray-200 max-w-md mb-6 font-bold">
            Could not connect to the Purrsonality CV Engine at {API_BASE_URL}.
            Make sure the FastAPI server is running with MediaPipe!
          </p>
          <button
            onClick={handleScanAgain}
            aria-label="Try reconnecting to the CV engine"
            className="neo-btn-lime px-8 py-3.5 text-lg font-heading tracking-wide border-3 border-black shadow-hard hover:shadow-hard-lg cursor-pointer min-h-[44px] flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5 mr-1" />
            <span>TRY AGAIN</span>
          </button>
        </motion.div>
      );
    }

    // 2. No Face Detected (Snap)
    if (predictResult && predictResult.predictions.length === 0) {
      return (
        <motion.div
          key="no-face"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="py-10 px-4 flex flex-col items-center text-center"
        >
          <div className="text-6xl mb-4 select-none">🥔🐱</div>
          <div className="inline-block bg-brand-pink text-white px-3 py-1 border-3 border-black font-arcade text-xs shadow-hard-sm mb-3 rotate-[-1deg]">
            VISION SCAN: 0 FACES FOUND
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl text-brand-yellow tracking-wide mb-3">
            ARE YOU EVEN THERE, HUMAN?
          </h2>
          <p className="font-meme text-lg sm:text-xl text-gray-200 max-w-md mb-8 font-bold">
            Step in front of the camera, you magnificent potato.
          </p>

          {capturedImage && (
            <div className="w-48 aspect-video bg-black border-3 border-black mb-6 overflow-hidden shadow-hard-sm">
              <img
                src={capturedImage}
                alt="Captured frame with no face detected"
                className="w-full h-full object-cover opacity-60 grayscale"
              />
            </div>
          )}

          <button
            onClick={handleScanAgain}
            aria-label="Try scanning your face again"
            className="neo-btn-pink px-8 py-4 text-xl font-heading tracking-wide border-4 border-black shadow-hard-lg hover:shadow-hard-xl cursor-pointer min-h-[44px] flex items-center gap-2"
          >
            <RotateCcw className="w-6 h-6 mr-1" />
            <span>SCAN AGAIN</span>
          </button>
        </motion.div>
      );
    }

    // 3. Default: Live Webcam Standby for Snap
    return (
      <motion.div
        key="snap-standby"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center"
      >
        <div className="w-full flex items-center justify-between border-b-4 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-brand-lime" />
            <span className="font-arcade text-xs md:text-sm text-brand-lime tracking-widest">
              OPTICAL FACIAL SENSOR // SNAP STANDBY
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-gray-400">
            <span>RES: 1280x720</span>
            <span className="text-brand-pink font-bold">MODE: 1-SHOT SNAP</span>
          </div>
        </div>

        {/* Webcam Viewport */}
        <div className="relative w-full aspect-video sm:aspect-[4/3] md:aspect-video bg-black border-4 border-black overflow-hidden flex items-center justify-center rounded-xs">
          {cameraState !== "denied" && cameraState !== "unavailable" && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.75}
              videoConstraints={{
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="w-full h-full object-cover"
            />
          )}

          {/* CRT Scanline Overlay */}
          <div className="absolute inset-0 crt-scanlines z-10 pointer-events-none" />

          {/* Subtle Scanning Laser */}
          <div className="absolute inset-x-0 h-[2px] bg-brand-lime shadow-[0_0_10px_#C6FF00] animate-laser pointer-events-none z-15 opacity-80" />

          {/* Corner Brackets */}
          <div className="absolute top-4 left-4 w-7 h-7 sm:w-10 sm:h-10 border-t-4 border-l-4 border-brand-lime z-20 pointer-events-none" />
          <div className="absolute top-4 right-4 w-7 h-7 sm:w-10 sm:h-10 border-t-4 border-r-4 border-brand-lime z-20 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-7 h-7 sm:w-10 sm:h-10 border-b-4 border-l-4 border-brand-lime z-20 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-7 h-7 sm:w-10 sm:h-10 border-b-4 border-r-4 border-brand-lime z-20 pointer-events-none" />

          {/* Center Target Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-14 h-14 sm:w-20 sm:h-20 border-2 border-brand-pink/60 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-brand-pink rounded-full shadow-[0_0_6px_#FF2E93]" />
            </div>
          </div>

          {/* Snap Analyzing Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/85 z-30 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 bg-brand-lime text-black border-4 border-black flex items-center justify-center shadow-hard mb-4 animate-spin">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl text-brand-lime tracking-wide mb-2">
                ANALYZING FACIAL GEOMETRY...
              </h3>
              <div className="bg-[#12121c] border-3 border-black px-4 py-2 shadow-hard-sm">
                <p className="font-arcade text-xs sm:text-sm text-brand-yellow font-bold tracking-wider">
                  {ROTATING_LOADING_MESSAGES[loadingPhraseIndex]}
                </p>
              </div>
            </div>
          )}

          {/* Camera Denied */}
          {cameraState === "denied" && (
            <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-25">
              <div className="w-16 h-16 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-3">
                <AlertTriangle className="w-8 h-8 text-black" />
              </div>
              <h3 className="font-heading text-3xl text-brand-pink">
                PAWS OFF?
              </h3>
              <p className="font-meme text-lg text-gray-200 mt-2 max-w-md font-bold">
                We need camera access to determine your purrsonality.
              </p>
              <p className="text-xs font-mono text-gray-400 mt-3">
                Please allow webcam access in your browser address bar.
              </p>
            </div>
          )}

          {/* Camera Unavailable */}
          {cameraState === "unavailable" && (
            <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-25">
              <div className="w-16 h-16 bg-brand-yellow text-black border-4 border-black flex items-center justify-center shadow-hard mb-3">
                <HelpCircle className="w-8 h-8 text-black" />
              </div>
              <h3 className="font-heading text-3xl text-brand-yellow">
                NO CAMERA DETECTED
              </h3>
              <p className="font-meme text-base text-gray-300 mt-2 max-w-md font-bold">
                {errorMessage || "Please connect a webcam to continue."}
              </p>
            </div>
          )}
        </div>

        {/* Snap Scan CTA Button */}
        <div className="mt-6 flex flex-col items-center w-full">
          <button
            onClick={handleSnapAndPredict}
            disabled={isAnalyzing || cameraState !== "granted"}
            aria-label="Capture snapshot and reveal your cat meme match"
            className="neo-btn-pink text-xl sm:text-2xl px-10 py-5 border-4 border-black shadow-hard-lg hover:shadow-hard-xl transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 min-h-[48px]"
          >
            <Camera className="w-7 h-7 group-hover:rotate-12 transition-transform" />
            <span>REVEAL MY PURRSONALITY</span>
            <Zap className="w-6 h-6 text-brand-yellow fill-brand-yellow" />
          </button>

          <p className="text-xs font-mono text-gray-400 mt-3 flex items-center gap-2">
            <span>🐱 1-CLICK SNAP ANALYSIS</span>
            <span>•</span>
            <span>POWERED BY MEDIAPIPE CV</span>
          </p>
        </div>
      </motion.div>
    );
  };

  // Render logic for REAL LIVE Mode
  const renderLiveContent = () => {
    if (scanError) {
      return (
        <motion.div
          key="live-error"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="py-12 px-4 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-5 rotate-[-3deg]">
            <AlertTriangle className="w-10 h-10 text-black" />
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl text-brand-pink tracking-wide mb-2">
            THE CAT UNPLUGGED THE SERVER.
          </h2>
          <p className="font-meme text-base sm:text-lg text-gray-200 max-w-md mb-6 font-bold">
            Could not connect to the Purrsonality CV Engine at {API_BASE_URL}.
            Make sure the FastAPI server is running with MediaPipe!
          </p>
          <button
            onClick={() => {
              setScanError(null);
              runLiveIteration();
            }}
            aria-label="Try reconnecting to the CV engine"
            className="neo-btn-lime px-8 py-3.5 text-lg font-heading tracking-wide border-3 border-black shadow-hard hover:shadow-hard-lg cursor-pointer min-h-[44px] flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5 mr-1" />
            <span>TRY AGAIN</span>
          </button>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="live-scanner-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full flex flex-col items-center"
      >
        {/* Top Live Feed Header Strip */}
        <div className="w-full flex items-center justify-between border-b-4 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-lime animate-pulse" />
            <span className="font-arcade text-xs md:text-sm text-brand-lime tracking-widest">
              LIVE CONTINUOUS CV STREAM // THROTTLED 600MS
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-gray-400">
            <span>RES: {frameWidth}x{frameHeight}</span>
            <span className="text-brand-lime font-bold">STREAM: ACTIVE</span>
          </div>
        </div>

        {/* 2-Column Responsive Layout: Webcam Stream vs Live Cat Preview */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 items-start">
          {/* Column 1: Live Webcam Viewport with Dynamic Bounding Box */}
          <div className="flex flex-col">
            <div className="relative w-full aspect-video sm:aspect-[4/3] md:aspect-video bg-black border-4 border-black overflow-hidden flex items-center justify-center rounded-xs shadow-hard">
              {cameraState !== "denied" && cameraState !== "unavailable" && (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.75}
                  videoConstraints={{
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }}
                  onUserMedia={handleUserMedia}
                  onUserMediaError={handleUserMediaError}
                  className="w-full h-full object-cover"
                />
              )}

              {/* CRT Scanline Overlay */}
              <div className="absolute inset-0 crt-scanlines z-10 pointer-events-none" />

              {/* Subtle Scanning Laser */}
              <div className="absolute inset-x-0 h-[2px] bg-brand-lime shadow-[0_0_12px_#C6FF00] animate-laser pointer-events-none z-15 opacity-85" />

              {/* Corner Reticle Brackets */}
              <div className="absolute top-3 left-3 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 border-brand-lime/70 z-20 pointer-events-none" />
              <div className="absolute top-3 right-3 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 border-brand-lime/70 z-20 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 border-brand-lime/70 z-20 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 border-brand-lime/70 z-20 pointer-events-none" />

              {/* Center Target Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border border-brand-pink/50 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-brand-pink rounded-full shadow-[0_0_6px_#FF2E93]" />
                </div>
              </div>

              {/* LIVE BOUNDING BOX OVERLAY */}
              {bbox && activeLivePrediction && cameraState === "granted" && (
                <motion.div
                  key="live-bbox"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    left: `${Math.max(0, Math.min(90, (bbox[0] / frameWidth) * 100))}%`,
                    top: `${Math.max(0, Math.min(90, (bbox[1] / frameHeight) * 100))}%`,
                    width: `${Math.min(100, (bbox[2] / frameWidth) * 100)}%`,
                    height: `${Math.min(100, (bbox[3] / frameHeight) * 100)}%`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 28,
                    mass: 0.6,
                  }}
                  className="absolute border-2 border-brand-lime shadow-[0_0_12px_rgba(198,255,0,0.5)] z-25 pointer-events-none"
                >
                  {/* Neon Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-brand-lime" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-brand-lime" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-brand-lime" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-brand-lime" />

                  {/* Expression Tag on Bounding Box */}
                  <div className="absolute -top-6 left-0 bg-brand-lime text-black font-arcade text-[10px] px-2 py-0.5 border border-black shadow-hard-sm flex items-center gap-1 font-bold whitespace-nowrap">
                    <span>🐱 {activeLivePrediction.label.toUpperCase()}</span>
                    <span className="opacity-80">
                      ({Math.round(activeLivePrediction.confidence * 100)}%)
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Camera Denied */}
              {cameraState === "denied" && (
                <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-25">
                  <div className="w-16 h-16 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-3">
                    <AlertTriangle className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="font-heading text-3xl text-brand-pink">
                    PAWS OFF?
                  </h3>
                  <p className="font-meme text-lg text-gray-200 mt-2 max-w-md font-bold">
                    We need camera access to determine your purrsonality.
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-3">
                    Please allow webcam access in your browser address bar.
                  </p>
                </div>
              )}

              {/* Camera Unavailable */}
              {cameraState === "unavailable" && (
                <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-25">
                  <div className="w-16 h-16 bg-brand-yellow text-black border-4 border-black flex items-center justify-center shadow-hard mb-3">
                    <HelpCircle className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="font-heading text-3xl text-brand-yellow">
                    NO CAMERA DETECTED
                  </h3>
                  <p className="font-meme text-base text-gray-300 mt-2 max-w-md font-bold">
                    {errorMessage || "Please connect a webcam to continue."}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Status / Analysis Text Bar */}
            <div className="mt-3 bg-[#11111c] border-3 border-black p-2.5 shadow-hard-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    liveLoading ? "bg-brand-yellow animate-ping" : "bg-brand-lime animate-pulse"
                  }`}
                />
                <span className="font-arcade text-[11px] text-brand-lime">
                  {liveLoading ? "CV IN FLIGHT" : "LIVE SENSOR"}
                </span>
              </div>

              <div className="font-arcade text-[11px] text-brand-yellow font-bold truncate max-w-[260px] sm:max-w-none">
                {liveLoading
                  ? ROTATING_LOADING_MESSAGES[loadingPhraseIndex]
                  : activeLivePrediction
                  ? `TRACKING: ${activeLivePrediction.label.toUpperCase()}`
                  : "CALIBRATING FACIAL SENSORS..."}
              </div>
            </div>
          </div>

          {/* Column 2: LIVE CAT ALTER-EGO PREVIEW */}
          <div className="flex flex-col">
            <div className="neo-card bg-[#18182a] border-4 border-black p-4 shadow-hard flex flex-col h-full">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                <span className="neo-badge bg-brand-pink text-white font-arcade text-xs">
                  LIVE CAT ALTER-EGO
                </span>
                <span className="font-mono text-[11px] text-brand-lime font-bold">
                  FASTAPI // CV SYNC
                </span>
              </div>

              {/* State A: Face Detected -> Real Matched Cat */}
              {activeLivePrediction && !isLiveNoFace ? (
                <div className="flex flex-col flex-grow justify-between">
                  <div>
                    {/* Expression Tag */}
                    <div className="mb-2">
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">
                        DETECTED EXPRESSION
                      </span>
                      <h3 className="font-heading text-2xl sm:text-3xl text-brand-yellow tracking-wide truncate">
                        {activeLivePrediction.label.toUpperCase()}
                      </h3>
                    </div>

                    {/* Cat Name & Caption */}
                    <div className="bg-[#12121d] border-2 border-black p-2.5 shadow-hard-sm mb-3">
                      <h4 className="font-heading text-xl text-brand-pink truncate">
                        {livePrediction?.cat?.name || `${activeLivePrediction.label} Cat`}
                      </h4>
                      {livePrediction?.cat?.caption && (
                        <p className="font-meme text-xs sm:text-sm text-gray-300 font-bold italic mt-0.5 line-clamp-2">
                          "{livePrediction.cat.caption}"
                        </p>
                      )}
                    </div>

                    {/* Real Local Cat Meme Image */}
                    <div className="relative w-full aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center shadow-hard-sm">
                      {liveCatImageUrl ? (
                        <motion.img
                          key={liveCatImageUrl}
                          initial={{ opacity: 0.7, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          src={liveCatImageUrl}
                          alt={`Live preview cat meme: ${livePrediction?.cat?.name || "Cat Meme"}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-gray-400 font-mono text-xs p-4 text-center">
                          Loading meme image...
                        </div>
                      )}
                      <div className="absolute inset-0 crt-scanlines pointer-events-none" />
                    </div>
                  </div>

                  {/* Feature Telemetry */}
                  {livePrediction?.features && (
                    <div className="mt-3 pt-2 border-t-2 border-black grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] text-gray-400">
                      <div className="bg-[#10101c] p-1 border border-black/50">
                        <span className="block text-gray-500">EAR</span>
                        <span className="text-brand-lime font-bold">
                          {livePrediction.features.ear_avg.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-[#10101c] p-1 border border-black/50">
                        <span className="block text-gray-500">MAR</span>
                        <span className="text-brand-yellow font-bold">
                          {livePrediction.features.mar.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-[#10101c] p-1 border border-black/50">
                        <span className="block text-gray-500">SMILE</span>
                        <span className="text-brand-pink font-bold">
                          {livePrediction.features.smile.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : /* State B: No Face Detected */
              isLiveNoFace ? (
                <div className="flex flex-col items-center justify-center text-center p-6 flex-grow">
                  <div className="text-5xl mb-3 select-none">🥔🐱</div>
                  <div className="inline-block bg-brand-pink text-white px-2.5 py-0.5 border-2 border-black font-arcade text-[10px] shadow-hard-sm mb-2">
                    NO FACE DETECTED
                  </div>
                  <h4 className="font-heading text-2xl text-brand-yellow tracking-wide mb-1">
                    ARE YOU EVEN THERE, HUMAN?
                  </h4>
                  <p className="font-meme text-xs sm:text-sm text-gray-300 font-bold max-w-xs">
                    Step in front of the camera, you magnificent potato.
                  </p>
                </div>
              ) : (
                /* State C: Calibrating / Starting */
                <div className="flex flex-col items-center justify-center text-center p-6 flex-grow">
                  <Sparkles className="w-10 h-10 text-brand-lime animate-spin mb-3" />
                  <h4 className="font-heading text-xl text-brand-lime tracking-wide">
                    CONNECTING TO CV ENGINE...
                  </h4>
                  <p className="font-mono text-xs text-gray-400 mt-1">
                    Throttling 1 frame every 600ms
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 17/18: Prominent Hardened "LOCK IT IN // REVEAL MY PURRSONALITY" Button */}
        <div className="mt-6 flex flex-col items-center w-full max-w-2xl">
          <button
            onClick={handleLockInLive}
            disabled={!hasValidLiveFace || cameraState !== "granted" || isLockingIn || isFinalized}
            aria-label="Lock in your current facial expression and reveal your cat match"
            className="neo-btn-pink text-xl sm:text-2xl px-10 py-5 border-4 border-black shadow-hard-lg hover:shadow-hard-xl transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 w-full min-h-[48px]"
          >
            <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
            <span>
              {isLockingIn ? "LOCKING IN VIBE..." : "LOCK IT IN // REVEAL MY PURRSONALITY"}
            </span>
            <Zap className="w-6 h-6 text-brand-yellow fill-brand-yellow animate-pulse" />
          </button>
          {!hasValidLiveFace && cameraState === "granted" && (
            <p className="text-xs font-mono text-gray-400 mt-2.5">
              💡 Face the camera to lock in your live purrsonality match!
            </p>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-65px)] p-4 md:p-8 flex flex-col items-center justify-center bg-noise overflow-x-hidden">
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Back to Home Button */}
        <button
          onClick={handleBackToHome}
          aria-label="Return to landing page"
          className="neo-btn bg-white text-black py-2 px-4 text-xs font-arcade hover:bg-gray-100 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        {/* Mode Switcher: LIVE vs 1-SHOT SNAP (only shown when not on finalized result screen) */}
        {!isFinalized && (
          <div className="flex items-center gap-1.5 bg-[#12121d] p-1 border-3 border-black shadow-hard-sm">
            <button
              onClick={() => setLiveMode(true)}
              aria-label="Switch to continuous live CV stream mode"
              className={`px-3 py-1.5 text-xs font-arcade tracking-wider border-2 border-black flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                liveMode
                  ? "bg-brand-lime text-black font-bold shadow-hard-sm"
                  : "bg-transparent text-gray-400 hover:text-white"
              }`}
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  liveMode ? "animate-pulse text-black" : "text-gray-500"
                }`}
              />
              <span>LIVE STREAM</span>
              {liveMode && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
              )}
            </button>

            <button
              onClick={() => setLiveMode(false)}
              aria-label="Switch to 1-shot snapshot scan mode"
              className={`px-3 py-1.5 text-xs font-arcade tracking-wider border-2 border-black flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                !liveMode
                  ? "bg-brand-pink text-white font-bold shadow-hard-sm"
                  : "bg-transparent text-gray-400 hover:text-white"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>1-SHOT SNAP</span>
            </button>
          </div>
        )}

        {/* Backend Health Status Indicator */}
        <div>
          {backendStatus === "online" ? (
            <div className="inline-flex items-center gap-2 bg-[#122216] border-3 border-black px-3.5 py-1.5 shadow-hard-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-lime animate-pulse inline-block" />
              <span className="font-arcade text-xs text-brand-lime tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-lime" />
                CV ENGINE: ONLINE
              </span>
            </div>
          ) : backendStatus === "offline" ? (
            <div className="inline-flex items-center gap-2 bg-[#2d1420] border-3 border-black px-3.5 py-1.5 shadow-hard-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-pink inline-block" />
              <span className="font-arcade text-xs text-brand-pink tracking-wider flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-brand-pink" />
                CV ENGINE: OFFLINE
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-[#1c1c28] border-3 border-black px-3.5 py-1.5 shadow-hard-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-yellow animate-ping inline-block" />
              <span className="font-arcade text-xs text-brand-yellow tracking-wider">
                CHECKING CV ENGINE...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl neo-card bg-[#141420] border-4 border-black p-4 sm:p-6 md:p-8 shadow-hard-xl relative">
        <AnimatePresence mode="wait">
          {isFinalized && predictResult && predictResult.predictions.length > 0 ? (
            <motion.div
              key="finalized-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <ResultView
                predictResult={predictResult}
                capturedImage={capturedImage}
                onScanAgain={handleScanAgain}
              />
            </motion.div>
          ) : liveMode ? (
            renderLiveContent()
          ) : (
            renderSnapContent()
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
