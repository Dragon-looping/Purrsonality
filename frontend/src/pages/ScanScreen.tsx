import React, { useEffect, useState, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Radio,
  Scan,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useWebcam, CAMERA_MESSAGES } from "../hooks/useWebcam";
import { predictExpression } from "../api/predict";

const SCAN_STATUS_PHRASES = [
  "sniffing your vibes...",
  "measuring sass level...",
  "consulting the cat council...",
  "calculating your purr-centage...",
  "interrogating the whiskers...",
  "checking for forbidden levels of silliness...",
] as const;

export const ScanScreen: React.FC = () => {
  const {
    setScreen,
    cameraState,
    isScanning,
    setIsScanning,
    currentPrediction,
    setPrediction,
    bbox,
  } = useAppStore();

  const { webcamRef, errorMessage, handleUserMedia, handleUserMediaError, captureFrame } =
    useWebcam();

  const [statusPhraseIndex, setStatusPhraseIndex] = useState(0);
  const liveTimerRef = useRef<number | null>(null);

  // Cycle rotating status messages
  useEffect(() => {
    const interval = window.setInterval(() => {
      setStatusPhraseIndex((prev) => (prev + 1) % SCAN_STATUS_PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Live expression detection loop
  const runLiveScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      const frameData = captureFrame();
      const result = await predictExpression(frameData);

      if (result.status === "success" && result.predictions.length > 0) {
        setPrediction(result.predictions, result.bbox);
      }
    } catch (err) {
      console.warn("Live scan pass encountered an error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, captureFrame, setIsScanning, setPrediction]);

  // Start live polling loop once camera is granted
  useEffect(() => {
    if (cameraState === "granted") {
      // Immediate first pass
      runLiveScan();

      liveTimerRef.current = window.setInterval(() => {
        runLiveScan();
      }, 2000);
    } else {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    }

    return () => {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, [cameraState, runLiveScan]);

  const activePrediction = currentPrediction[0] ?? null;

  return (
    <div className="min-h-[calc(100vh-65px)] p-4 md:p-8 flex flex-col items-center justify-center bg-noise">
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <button
          onClick={() => setScreen("landing")}
          className="neo-btn bg-white text-black py-2 px-4 text-xs font-arcade hover:bg-gray-100 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        {/* Live Status Indicator */}
        <div className="inline-flex items-center gap-2 bg-[#161624] px-3.5 py-1.5 border-3 border-black shadow-hard-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-lime animate-pulse inline-block" />
          <span className="font-arcade text-xs text-brand-lime tracking-wider flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            LIVE SCANNER ACTIVE
          </span>
        </div>
      </div>

      {/* Main Arcade CRT Scanner Frame */}
      <div className="w-full max-w-4xl neo-card bg-[#141420] border-4 border-black p-3 sm:p-5 md:p-6 shadow-hard-xl relative">
        {/* Arcade Bezel Header Strip */}
        <div className="flex items-center justify-between border-b-4 border-black pb-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-brand-lime" />
            <span className="font-arcade text-xs md:text-sm text-brand-lime tracking-widest">
              OPTICAL FACIAL SENSOR // SCANNER FEED
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-gray-400">
            <span>RES: 640x480</span>
            <span className="text-brand-yellow font-bold">FPS: 30</span>
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

          {/* Animated Laser Sweep Line */}
          {isScanning && (
            <div className="absolute inset-x-0 h-1 bg-brand-lime shadow-[0_0_12px_#C6FF00] z-20 animate-laser pointer-events-none" />
          )}

          {/* Face Target Bounding Box Overlay */}
          {bbox && activePrediction && cameraState === "granted" && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute border-3 border-brand-lime shadow-hard-sm z-20 pointer-events-none flex flex-col justify-between"
              style={{
                left: `${(bbox[0] / 640) * 100}%`,
                top: `${(bbox[1] / 480) * 100}%`,
                width: `${(bbox[2] / 640) * 100}%`,
                height: `${(bbox[3] / 480) * 100}%`,
              }}
            >
              <div className="bg-brand-lime text-black font-arcade text-[10px] px-1.5 py-0.5 self-start border-b-2 border-r-2 border-black">
                FACE DETECTED: {activePrediction.label.toUpperCase()}
              </div>
            </motion.div>
          )}

          {/* Camera Error State: Denied or Unavailable */}
          {(cameraState === "denied" || cameraState === "unavailable") && (
            <div className="absolute inset-0 bg-[#161622] flex flex-col items-center justify-center p-6 text-center z-25">
              <div className="w-16 h-16 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-3">
                <AlertTriangle className="w-8 h-8 text-black" />
              </div>
              <h3 className="font-heading text-2xl text-brand-pink">
                {cameraState === "denied" ? "PAWS OFF THE WEBCAM?" : "MISSING WEBCAM"}
              </h3>
              <p className="font-meme text-lg text-gray-200 mt-1 max-w-md font-bold">
                {errorMessage ||
                  (cameraState === "denied"
                    ? CAMERA_MESSAGES.denied
                    : CAMERA_MESSAGES.unavailable)}
              </p>
              <p className="text-xs font-mono text-gray-400 mt-3">
                Please grant camera access in your browser address bar to unlock the scanner.
              </p>
            </div>
          )}

          {/* Small Rotating Status Phrase Overlay (Bottom of Viewport) */}
          <div className="absolute bottom-3 inset-x-4 sm:inset-x-8 z-25 pointer-events-none">
            <div className="bg-black/85 border-2 border-brand-lime px-3.5 py-1.5 shadow-hard-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-lime animate-spin" />
                <span className="font-arcade text-[10px] sm:text-xs text-brand-lime">
                  ANALYZING
                </span>
              </div>
              <span className="font-meme text-xs sm:text-sm text-brand-yellow font-bold italic truncate ml-2">
                {SCAN_STATUS_PHRASES[statusPhraseIndex]}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Technical Readout Card */}
        <div className="mt-4 pt-3 border-t-4 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">🐱</span>
            <div>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                CURRENT FACIAL EXPRESSION
              </p>
              <p className="font-heading text-xl text-brand-yellow tracking-wide">
                {activePrediction
                  ? `${activePrediction.label.toUpperCase()} (${Math.round(
                      activePrediction.confidence * 100
                    )}% MATCH)`
                  : "CALIBRATING SENSORS..."}
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-gray-400 sm:text-right">
            <div>TRACKING: 478 3D LANDMARKS</div>
            <div className="text-brand-lime">RULE-BASED GEOMETRY ENGINE</div>
          </div>
        </div>
      </div>
    </div>
  );
};
