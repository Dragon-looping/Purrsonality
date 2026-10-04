import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Radio,
  Flame,
  HelpCircle,
  CheckCircle2,
  XCircle,
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

export const ScanScreen: React.FC = () => {
  const {
    setScreen,
    cameraState,
    backendStatus,
    setBackendStatus,
    scanError,
    setScanError,
    resetScan,
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

  // Rotate funny loading messages during prediction in-flight
  useEffect(() => {
    if (!liveLoading) return;
    const interval = setInterval(() => {
      setLoadingPhraseIndex(
        (prev) => (prev + 1) % ROTATING_LOADING_MESSAGES.length
      );
    }, 700);
    return () => clearInterval(interval);
  }, [liveLoading]);

  // Track component mount/unmount to cleanly terminate loops
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

  // Continuous REAL LIVE Prediction Runner (Throttled to 500-600ms with strictly 1 in-flight)
  const runLiveIteration = useCallback(async () => {
    if (
      !isMountedRef.current ||
      inFlightRef.current ||
      cameraState !== "granted"
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
      if (isMountedRef.current) {
        setLivePrediction(res);
        setBackendStatus("online");
        setScanError(null);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Cleanly aborted
      }
      if (isMountedRef.current) {
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
    cameraState,
    captureFrame,
    setLiveLoading,
    setLivePrediction,
    setBackendStatus,
    setScanError,
  ]);

  // Continuous loop schedule: runs automatically whenever camera is active and no server error
  useEffect(() => {
    if (cameraState === "granted" && !scanError) {
      runLiveIteration();
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
  }, [cameraState, scanError, runLiveIteration, setLiveLoading]);

  // Back to home action
  const handleBackToHome = useCallback(() => {
    resetScan();
    setScreen("landing");
  }, [resetScan, setScreen]);

  // Active prediction breakdown
  const hasFace = Boolean(
    livePrediction &&
      Array.isArray(livePrediction.predictions) &&
      livePrediction.predictions.length > 0
  );
  const activePrediction = livePrediction?.predictions?.[0];
  const catImageUrl = getCatImageUrl(livePrediction?.cat);

  // Frame dimension scaling for bounding box
  const frameWidth =
    livePrediction?.frame_size?.[0] ||
    webcamRef.current?.video?.videoWidth ||
    640;
  const frameHeight =
    livePrediction?.frame_size?.[1] ||
    webcamRef.current?.video?.videoHeight ||
    480;

  // Playful game score purrcentage calculation
  const purrcentage = useMemo(() => {
    if (!activePrediction) return 0;
    const base = Math.round(activePrediction.confidence * 100);
    const label = activePrediction.label.toLowerCase();
    let bonus = 0;
    if (label === "happy") bonus = 3;
    if (label === "surprised") bonus = 2;
    if (label === "eyes closed") bonus = 1;
    return Math.min(99, Math.max(75, base + bonus));
  }, [activePrediction]);

  return (
    <div className="min-h-[calc(100vh-65px)] p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center bg-noise overflow-x-hidden">
      {/* Top Header Bar */}
      <div className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Back to Home Button */}
        <button
          onClick={handleBackToHome}
          aria-label="Return to landing page"
          className="neo-btn bg-white text-black py-2 px-4 text-xs font-arcade hover:bg-gray-100 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer min-h-[44px] flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO HOME</span>
        </button>

        {/* Center Live Stream Indicator */}
        <div className="flex items-center gap-2 bg-[#12121d] px-3.5 py-1.5 border-3 border-black shadow-hard-sm">
          <Radio className="w-4 h-4 text-brand-lime animate-pulse" />
          <span className="font-arcade text-xs md:text-sm text-brand-lime tracking-widest">
            REAL-TIME FACE-TO-CAT COMPARISON
          </span>
        </div>

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
      {scanError ? (
        /* Backend Offline / Connection Error State */
        <motion.div
          key="server-error"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl neo-card bg-[#161626] border-4 border-black p-8 sm:p-12 flex flex-col items-center text-center shadow-hard-xl"
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
      ) : (
        /* Real-Time Live Face-to-Cat Side-by-Side Comparison Grid */
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-6 items-stretch">
          {/* ================================================================ */}
          {/* LEFT PANEL: "YOU" / LIVE WEBCAM & TELEMETRY                      */}
          {/* ================================================================ */}
          <div className="neo-card bg-[#141424] border-4 border-black p-4 sm:p-5 shadow-hard flex flex-col justify-between">
            <div>
              {/* Left Panel Header */}
              <div className="flex items-center justify-between border-b-3 border-black pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="neo-badge bg-brand-lime text-black font-arcade text-xs">
                    YOU
                  </span>
                  <span className="font-heading text-xl text-brand-yellow tracking-wide">
                    YOUR FACE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cameraState === "granted"
                        ? "bg-brand-lime animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                    {cameraState === "granted" ? "LIVE SENSOR" : "CAMERA OFF"}
                  </span>
                </div>
              </div>

              {/* Live Webcam Viewport with Dynamic Bounding Box Overlay */}
              <div className="relative w-full aspect-video sm:aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center rounded-xs shadow-hard-sm">
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

                {/* Scanning Laser */}
                <div className="absolute inset-x-0 h-[2px] bg-brand-lime shadow-[0_0_12px_#C6FF00] animate-laser pointer-events-none z-15 opacity-85" />

                {/* Neon Corner Brackets */}
                <div className="absolute top-2.5 left-2.5 w-6 h-6 border-t-3 border-l-3 border-brand-lime/80 z-20 pointer-events-none" />
                <div className="absolute top-2.5 right-2.5 w-6 h-6 border-t-3 border-r-3 border-brand-lime/80 z-20 pointer-events-none" />
                <div className="absolute bottom-2.5 left-2.5 w-6 h-6 border-b-3 border-l-3 border-brand-lime/80 z-20 pointer-events-none" />
                <div className="absolute bottom-2.5 right-2.5 w-6 h-6 border-b-3 border-r-3 border-brand-lime/80 z-20 pointer-events-none" />

                {/* LIVE BOUNDING BOX OVERLAY */}
                {bbox && activePrediction && cameraState === "granted" && (
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
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-brand-lime" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-brand-lime" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-brand-lime" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-brand-lime" />

                    {/* Expression Tag on Bounding Box */}
                    <div className="absolute -top-6 left-0 bg-brand-lime text-black font-arcade text-[10px] px-2 py-0.5 border border-black shadow-hard-sm flex items-center gap-1 font-bold whitespace-nowrap">
                      <span>🐱 {activePrediction.label.toUpperCase()}</span>
                      <span className="opacity-80">
                        ({Math.round(activePrediction.confidence * 100)}%)
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Camera Permission Denied Overlay */}
                {cameraState === "denied" && (
                  <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-30">
                    <div className="w-14 h-14 bg-brand-pink text-white border-3 border-black flex items-center justify-center shadow-hard mb-3">
                      <AlertTriangle className="w-7 h-7 text-black" />
                    </div>
                    <h3 className="font-heading text-2xl text-brand-pink">
                      PAWS OFF?
                    </h3>
                    <p className="font-meme text-sm text-gray-200 mt-2 max-w-xs font-bold">
                      We need camera access to compare your purrsonality. Please allow webcam in your address bar!
                    </p>
                  </div>
                )}

                {/* Camera Unavailable Overlay */}
                {cameraState === "unavailable" && (
                  <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-30">
                    <div className="w-14 h-14 bg-brand-yellow text-black border-3 border-black flex items-center justify-center shadow-hard mb-3">
                      <HelpCircle className="w-7 h-7 text-black" />
                    </div>
                    <h3 className="font-heading text-2xl text-brand-yellow">
                      NO CAMERA DETECTED
                    </h3>
                    <p className="font-meme text-sm text-gray-200 mt-2 max-w-xs font-bold">
                      {errorMessage || "Please connect a webcam to continue."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Left Panel Bottom: Live Expression & Telemetry */}
            <div className="mt-4">
              {hasFace && activePrediction ? (
                <div className="space-y-2.5">
                  {/* Detected Expression */}
                  <div className="bg-[#0f0f1a] border-2 border-black p-2.5 shadow-hard-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                        EXPRESSION:
                      </span>
                      <span className="font-heading text-2xl text-brand-yellow tracking-wide">
                        {activePrediction.label.toUpperCase()}
                      </span>
                    </div>
                    <span className="font-arcade text-[10px] text-brand-lime bg-black/60 px-2 py-0.5 border border-brand-lime/40">
                      CONFIDENCE: {Math.round(activePrediction.confidence * 100)}%
                    </span>
                  </div>

                  {/* Real-time Telemetry Metrics */}
                  {livePrediction?.features && (
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="bg-[#0e0e18] p-2 border-2 border-black shadow-hard-sm">
                        <span className="block text-[10px] text-gray-400 uppercase">EAR</span>
                        <span className="font-bold text-brand-lime text-sm sm:text-base">
                          {livePrediction.features.ear_avg.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-[#0e0e18] p-2 border-2 border-black shadow-hard-sm">
                        <span className="block text-[10px] text-gray-400 uppercase">MAR</span>
                        <span className="font-bold text-brand-yellow text-sm sm:text-base">
                          {livePrediction.features.mar.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-[#0e0e18] p-2 border-2 border-black shadow-hard-sm">
                        <span className="block text-[10px] text-gray-400 uppercase">SMILE</span>
                        <span className="font-bold text-brand-pink text-sm sm:text-base">
                          {livePrediction.features.smile.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No Face Error State */
                <div className="bg-[#24121d] border-2 border-black p-3.5 shadow-hard-sm flex items-center gap-3">
                  <div className="text-3xl select-none">🥔🐱</div>
                  <div>
                    <h4 className="font-heading text-xl text-brand-pink tracking-wide leading-tight">
                      SHOW ME YOUR FACE
                    </h4>
                    <p className="font-meme text-xs text-gray-300 font-bold mt-0.5">
                      Center your face in front of the camera lens to start matching!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* CENTER DIVIDER: VS BADGE (Desktop Vertical / Mobile Horizontal)  */}
          {/* ================================================================ */}
          <div className="hidden lg:flex flex-col items-center justify-center py-6 px-1">
            <div className="w-12 h-12 bg-brand-yellow text-black border-3 border-black flex items-center justify-center shadow-hard rotate-[6deg] font-heading text-xl select-none">
              VS
            </div>
            <div className="w-[3px] h-24 bg-brand-pink my-3 shadow-hard-sm" />
            <Flame className="w-6 h-6 text-brand-pink animate-bounce" />
          </div>

          <div className="flex lg:hidden items-center justify-center gap-3 my-1">
            <div className="h-[2px] flex-grow bg-brand-pink" />
            <span className="bg-brand-yellow text-black px-3.5 py-1 border-2 border-black font-heading text-base shadow-hard-sm select-none">
              VS
            </span>
            <div className="h-[2px] flex-grow bg-brand-pink" />
          </div>

          {/* ================================================================ */}
          {/* RIGHT PANEL: "YOUR PURRSONALITY" / LIVE MATCHED CAT MEME         */}
          {/* ================================================================ */}
          <div className="neo-card bg-[#161626] border-4 border-black p-4 sm:p-5 shadow-hard flex flex-col justify-between">
            <div>
              {/* Right Panel Header */}
              <div className="flex items-center justify-between border-b-3 border-black pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="neo-badge bg-brand-pink text-white font-arcade text-xs">
                    YOUR PURRSONALITY
                  </span>
                  <span className="font-heading text-xl text-brand-pink tracking-wide">
                    YOUR CAT MATCH
                  </span>
                </div>
                <span className="text-[10px] font-mono text-brand-lime font-bold">
                  LIVE SYNC
                </span>
              </div>

              {/* Matched Cat Display or Searching State */}
              {hasFace && activePrediction && catImageUrl ? (
                <div>
                  {/* Matched Real Cat Meme Image */}
                  <div className="relative w-full aspect-video sm:aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center rounded-xs shadow-hard-sm mb-3">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={catImageUrl}
                        initial={{ opacity: 0.6, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0.6 }}
                        transition={{ duration: 0.2 }}
                        src={catImageUrl}
                        alt={livePrediction?.cat?.name || "Matched Cat Meme"}
                        className="w-full h-full object-cover"
                      />
                    </AnimatePresence>
                    <div className="absolute inset-0 crt-scanlines pointer-events-none" />
                    <div className="absolute top-2 right-2 bg-brand-pink text-white font-arcade text-[10px] px-2 py-0.5 border border-black shadow-hard-sm">
                      MATCH: {activePrediction.label.toUpperCase()}
                    </div>
                  </div>

                  {/* Cat Name & Caption Box */}
                  <div className="bg-[#10101b] border-2 border-black p-3 shadow-hard-sm mb-3">
                    <h4 className="font-heading text-2xl text-brand-pink tracking-wide truncate">
                      {livePrediction?.cat?.name || `${activePrediction.label} Cat`}
                    </h4>
                    {livePrediction?.cat?.caption && (
                      <p className="font-meme text-xs sm:text-sm text-gray-200 font-bold italic mt-1 line-clamp-2">
                        "{livePrediction.cat.caption}"
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* No Prediction / Searching For Your Cat State */
                <div className="w-full aspect-video sm:aspect-[4/3] flex flex-col items-center justify-center text-center p-6 bg-[#0f0f1b] border-3 border-black border-dashed mb-3">
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.5,
                      ease: "easeInOut",
                    }}
                    className="text-6xl mb-3 select-none"
                  >
                    🐱🔍
                  </motion.div>
                  <div className="inline-block bg-brand-yellow text-black px-2.5 py-0.5 border-2 border-black font-arcade text-[10px] shadow-hard-sm mb-1.5 font-bold">
                    AWAITING FACE
                  </div>
                  <h4 className="font-heading text-2xl text-brand-yellow tracking-wide mb-1">
                    SEARCHING FOR YOUR CAT...
                  </h4>
                  <p className="font-meme text-xs sm:text-sm text-gray-300 font-bold max-w-xs mt-1">
                    Look into the camera, smile, open wide, or snooze to reveal your matching cat meme in real time!
                  </p>
                  {liveLoading && (
                    <p className="font-arcade text-[10px] text-brand-lime mt-2.5 animate-pulse">
                      {ROTATING_LOADING_MESSAGES[loadingPhraseIndex]}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Panel Bottom: Playful Purrcentage / Game Score */}
            <div className="mt-1">
              <div className="bg-[#0e0e18] border-2 border-black p-3 shadow-hard-sm">
                <div className="flex items-center justify-between text-xs font-arcade">
                  <span className="text-gray-300">PURR-CENTAGE:</span>
                  <span className="text-brand-lime font-bold text-base">
                    {hasFace ? `${purrcentage}%` : "--"}
                  </span>
                </div>
                <div className="w-full bg-black h-2.5 border border-black mt-1.5 overflow-hidden">
                  <motion.div
                    className="bg-brand-lime h-full"
                    initial={{ width: 0 }}
                    animate={{ width: hasFace ? `${purrcentage}%` : "0%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="block text-[10px] font-mono text-gray-400 mt-1.5">
                  🎮 PLAYFUL GAME SCORE — NOT A CLINICAL METRIC
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
