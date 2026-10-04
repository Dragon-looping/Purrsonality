import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useWebcam } from "../hooks/useWebcam";
import {
  predictExpression,
  checkBackendHealth,
  getCatImageUrl,
} from "../api/predict";
import { ROTATING_LOADING_MESSAGES } from "../config/theme";

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
  } = useAppStore();

  const {
    webcamRef,
    errorMessage,
    handleUserMedia,
    handleUserMediaError,
    captureFrame,
  } = useWebcam();

  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

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
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setLoadingPhraseIndex(
        (prev) => (prev + 1) % ROTATING_LOADING_MESSAGES.length
      );
    }, 700);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // SNAP action: captures one frame and requests prediction from FastAPI
  const handleSnapAndPredict = useCallback(async () => {
    if (isAnalyzing || cameraState !== "granted") return;
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
    captureFrame,
    setCapturedImage,
    setIsAnalyzing,
    setPredictResult,
    setScanError,
  ]);

  const activePrediction = predictResult?.predictions?.[0];
  const catImageUrl = getCatImageUrl(predictResult?.cat);
  const isNoFace = predictResult && predictResult.predictions.length === 0;

  // Render logic for different view states
  const renderContent = () => {
    // 1. Server Error State
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
            Could not connect to the Purrsonality CV Engine at http://127.0.0.1:8000.
            Make sure the FastAPI server is running with MediaPipe!
          </p>
          <button
            onClick={resetScan}
            className="neo-btn-lime px-8 py-3.5 text-lg font-heading tracking-wide border-3 border-black shadow-hard hover:shadow-hard-lg cursor-pointer"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            TRY AGAIN
          </button>
        </motion.div>
      );
    }

    // 2. No Face Detected State
    if (isNoFace) {
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
                alt="Captured frame with no face"
                className="w-full h-full object-cover opacity-60 grayscale"
              />
            </div>
          )}

          <button
            onClick={resetScan}
            className="neo-btn-pink px-8 py-4 text-xl font-heading tracking-wide border-4 border-black shadow-hard-lg hover:shadow-hard-xl cursor-pointer"
          >
            <RotateCcw className="w-6 h-6 mr-2" />
            SCAN AGAIN
          </button>
        </motion.div>
      );
    }

    // 3. Prediction Result State
    if (predictResult && activePrediction) {
      return (
        <motion.div
          key="result-view"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="flex flex-col items-center text-center"
        >
          {/* Result Title Header */}
          <div className="mb-4">
            <span className="font-arcade text-xs sm:text-sm text-brand-lime tracking-widest block mb-1">
              ANALYSIS COMPLETE // MATCH CONFIRMED
            </span>
            <h2 className="font-heading text-3xl sm:text-5xl text-white tracking-wider">
              YOUR PURRSONALITY IS:{" "}
              <span className="text-brand-yellow underline decoration-brand-pink decoration-4">
                {activePrediction.label.toUpperCase()}
              </span>
            </h2>
          </div>

          {/* Cat Name & Meme Caption */}
          <div className="bg-[#1c1c2e] border-3 border-black px-5 py-3 shadow-hard-sm max-w-2xl w-full mb-6">
            <h3 className="font-heading text-2xl sm:text-3xl text-brand-pink mb-1">
              {predictResult.cat?.name || `${activePrediction.label} Cat`}
            </h3>
            {predictResult.cat?.caption && (
              <p className="font-meme text-base sm:text-lg text-gray-200 font-bold italic">
                "{predictResult.cat.caption}"
              </p>
            )}
          </div>

          {/* Side-by-Side Face vs Matched Cat Layout */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 my-2 w-full">
            {/* Left Card: Captured User Frame */}
            <div className="neo-card bg-[#181828] border-4 border-black p-3 sm:p-4 flex flex-col items-center shadow-hard">
              <div className="flex items-center justify-between w-full mb-2 border-b-2 border-black pb-2">
                <span className="neo-badge bg-brand-lime text-black font-arcade text-xs">
                  YOUR FACE
                </span>
                <span className="font-mono text-[11px] text-gray-400">
                  LIVE CAPTURE
                </span>
              </div>

              <div className="relative w-full aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Your Captured Face"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400 font-mono text-xs">
                    No captured frame
                  </div>
                )}
                <div className="absolute inset-0 crt-scanlines pointer-events-none" />
              </div>
            </div>

            {/* Center Neon "VS" Badge */}
            <div className="flex flex-col items-center justify-center select-none py-2">
              <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-brand-yellow text-black border-4 border-black shadow-hard-lg rounded-full flex items-center justify-center rotate-[-6deg] transform hover:scale-110 transition-transform">
                <span className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-widest text-black drop-shadow-[2px_2px_0px_#FF2E93]">
                  VS
                </span>
              </div>
            </div>

            {/* Right Card: Matched Real Cat Meme */}
            <div className="neo-card bg-[#181828] border-4 border-black p-3 sm:p-4 flex flex-col items-center shadow-hard">
              <div className="flex items-center justify-between w-full mb-2 border-b-2 border-black pb-2">
                <span className="neo-badge bg-brand-pink text-white font-arcade text-xs">
                  MATCHED CAT
                </span>
                <span className="font-mono text-[11px] text-brand-yellow font-bold">
                  {Math.round(activePrediction.confidence * 100)}% VIBE
                </span>
              </div>

              <div className="relative w-full aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center">
                {catImageUrl ? (
                  <img
                    src={catImageUrl}
                    alt={predictResult.cat?.name || "Matched Cat Meme"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-4 text-center text-gray-400 font-mono text-xs">
                    No local cat image found
                  </div>
                )}
                <div className="absolute inset-0 crt-scanlines pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Action Button: SCAN AGAIN */}
          <div className="mt-8">
            <button
              onClick={resetScan}
              className="neo-btn-pink text-xl sm:text-2xl px-10 py-4 border-4 border-black shadow-hard-lg hover:shadow-hard-xl transition-all cursor-pointer group"
            >
              <RotateCcw className="w-6 h-6 mr-2 group-hover:-rotate-90 transition-transform" />
              SCAN AGAIN
            </button>
          </div>
        </motion.div>
      );
    }

    // 4. Default: Live Webcam Scanner View
    return (
      <motion.div
        key="webcam-scanner"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center"
      >
        {/* Arcade Bezel Header Strip */}
        <div className="w-full flex items-center justify-between border-b-4 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-brand-lime" />
            <span className="font-arcade text-xs md:text-sm text-brand-lime tracking-widest">
              OPTICAL FACIAL SENSOR // SCANNER FEED
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-gray-400">
            <span>FRAME: 1-SHOT SNAP</span>
            <span className="text-brand-yellow font-bold">STANDBY</span>
          </div>
        </div>

        {/* Webcam Viewport Frame */}
        <div className="relative w-full aspect-video sm:aspect-[4/3] md:aspect-video bg-black border-4 border-black overflow-hidden flex items-center justify-center rounded-xs">
          {/* Real Webcam Component */}
          {cameraState !== "denied" && cameraState !== "unavailable" && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
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

          {/* CRT Scanline Overlay Effect */}
          <div className="absolute inset-0 crt-scanlines z-10 pointer-events-none" />

          {/* Corner HUD Target Brackets */}
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

          {/* Analyzing Loading Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center p-6 text-center">
              {/* Animated Laser Sweep */}
              <div className="absolute inset-x-0 h-1 bg-brand-lime shadow-[0_0_14px_#C6FF00] animate-laser pointer-events-none" />

              <div className="w-14 h-14 bg-brand-lime text-black border-4 border-black flex items-center justify-center shadow-hard mb-4 animate-spin">
                <Sparkles className="w-8 h-8 text-black" />
              </div>

              <h3 className="font-heading text-2xl sm:text-3xl text-brand-lime tracking-wide mb-2">
                ANALYZING FACIAL GEOMETRY...
              </h3>

              {/* Rotating Funny Loading Message */}
              <div className="bg-[#12121c] border-3 border-black px-4 py-2 shadow-hard-sm">
                <p className="font-arcade text-xs sm:text-sm text-brand-yellow font-bold tracking-wider">
                  {ROTATING_LOADING_MESSAGES[loadingPhraseIndex]}
                </p>
              </div>
            </div>
          )}

          {/* Camera Denied / Error Overlay */}
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

          {/* Camera Unavailable Overlay */}
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
            className="neo-btn-pink text-xl sm:text-2xl px-10 py-5 border-4 border-black shadow-hard-lg hover:shadow-hard-xl transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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

  return (
    <div className="min-h-[calc(100vh-65px)] p-4 md:p-8 flex flex-col items-center justify-center bg-noise">
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <button
          onClick={() => {
            resetScan();
            setScreen("landing");
          }}
          className="neo-btn bg-white text-black py-2 px-4 text-xs font-arcade hover:bg-gray-100 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

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
          {renderContent()}
        </AnimatePresence>
      </div>
    </div>
  );
};
