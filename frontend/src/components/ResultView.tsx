import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  Copy,
  Check,
  Download,
  Sparkles,
  Flame,
  Award,
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import type { PredictResponse } from "../api/predict";
import { getCatImageUrl } from "../api/predict";
import { getExpressionBlurb } from "../config/theme";

interface ResultViewProps {
  predictResult?: PredictResponse | null;
  capturedImage: string | null;
  onScanAgain: () => void;
}

const PurrcentageCounter: React.FC<{ target: number }> = ({ target }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1100;
    const startTime = performance.now();

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = Math.round(ease * target);
      setCount(currentVal);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      }
    };

    const animId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animId);
  }, [target]);

  return <span>{count}%</span>;
};

export const ResultView: React.FC<ResultViewProps> = ({
  predictResult,
  capturedImage,
  onScanAgain,
}) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(true);
  const exportCardRef = useRef<HTMLDivElement>(null);

  // Trigger screen flash and confetti on mount
  useEffect(() => {
    const flashTimer = setTimeout(() => setShowFlash(false), 320);

    try {
      confetti({
        particleCount: 85,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#FF2E93", "#C6FF00", "#FFE600", "#7B2FFF"],
      });
    } catch {
      // Fallback if canvas context is blocked
    }

    return () => clearTimeout(flashTimer);
  }, []);

  // 1. Guard against missing or corrupt result data (Section 4)
  if (
    !predictResult ||
    !Array.isArray(predictResult.predictions) ||
    predictResult.predictions.length === 0
  ) {
    return (
      <div className="w-full max-w-xl mx-auto neo-card bg-[#141420] border-4 border-black p-6 sm:p-8 text-center shadow-hard-xl">
        <div className="text-6xl mb-4 select-none">😿</div>
        <div className="inline-block bg-brand-pink text-white font-arcade text-xs px-3 py-1 border-3 border-black shadow-hard-sm mb-3 rotate-[-1deg]">
          DATA MISMATCH
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl text-brand-pink mb-3 tracking-wide">
          THE CATS LOST YOUR RESULT
        </h2>
        <p className="font-meme text-base text-gray-300 font-bold mb-6">
          Something went sideways in the cat council archives. Let's try that scan one more time!
        </p>
        <button
          onClick={onScanAgain}
          aria-label="Scan your face again"
          className="neo-btn-lime px-8 py-3.5 text-lg font-heading tracking-wide border-4 border-black shadow-hard hover:shadow-hard-lg cursor-pointer inline-flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5 mr-1" />
          <span>SCAN AGAIN</span>
        </button>
      </div>
    );
  }

  const activePrediction = predictResult.predictions[0];
  const cat = predictResult.cat;
  const label = activePrediction?.label || "Neutral";
  const catName = cat?.name || `${label} Cat`;
  const catCaption = cat?.caption || "Living nine chaotic lives with zero regrets.";
  const catImageUrl = getCatImageUrl(cat);
  const confidenceScore =
    typeof activePrediction?.confidence === "number" && !isNaN(activePrediction.confidence)
      ? activePrediction.confidence
      : 0.95;
  const purrcentage = Math.round(confidenceScore * 100);
  const blurb = getExpressionBlurb(label);

  // 2. Safe Clipboard Action (Section 6)
  const handleCopy = async () => {
    const text = `I got ${label.toUpperCase()} on Purrsonality 🐱\nCat match: ${catName}\nPurrcentage: ${purrcentage}%`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2400);
        return;
      }
      throw new Error("Clipboard API not available");
    } catch {
      // Fallback copy using hidden textarea
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (success) {
          setCopyStatus("copied");
          setTimeout(() => setCopyStatus("idle"), 2400);
          return;
        }
      } catch {
        // Fallback
      }
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  };

  // 3. Safe Image Export Action (Section 7)
  const handleSaveImage = async () => {
    if (!exportCardRef.current || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const dataUrl = await toPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#141420",
      });
      const link = document.createElement("a");
      const cleanSlug = label.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      link.download = `purrsonality-${cleanSlug}-result.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export result card image:", err);
      setSaveError("THE CAT ATE THE DOWNLOAD");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Dramatic Screen Flash */}
      {showFlash && (
        <motion.div
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="fixed inset-0 bg-white z-50 pointer-events-none"
        />
      )}

      {/* Main Exportable Result Card */}
      <div
        ref={exportCardRef}
        className="w-full max-w-3xl flex flex-col items-center p-4 sm:p-6 md:p-8 bg-[#141420] border-4 border-black shadow-hard-xl rounded-none text-center"
      >
        {/* Top: Header Sticker */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-brand-yellow text-black px-4 py-1 border-3 border-black font-arcade text-xs sm:text-sm shadow-hard-sm mb-3 rotate-[-1deg]"
        >
          <Sparkles className="w-4 h-4 text-black" />
          PURRSONALITY RESULT
          <Award className="w-4 h-4 text-black" />
        </motion.div>

        {/* Main: YOU ARE: [EXPRESSION] */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 18,
            delay: 0.1,
          }}
          className="mb-3 max-w-full"
        >
          <span className="font-arcade text-xs sm:text-sm text-brand-lime tracking-widest block mb-0.5">
            YOU ARE:
          </span>
          <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl text-white tracking-wider leading-none drop-shadow-[4px_4px_0px_#000000] break-words">
            <span className="text-brand-pink underline decoration-brand-yellow decoration-4 underline-offset-4">
              {label.toUpperCase()}
            </span>
          </h1>
        </motion.div>

        {/* PURR-CENTAGE SCORE BADGE with Game Score Disclaimer (Section 5) */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 16,
            delay: 0.2,
          }}
          className="mb-4 inline-flex flex-wrap items-center justify-center gap-2.5 bg-[#1d1d2e] border-3 border-black px-4 py-1.5 shadow-hard-sm rotate-[1.5deg]"
        >
          <div className="flex items-center gap-1.5 font-arcade text-xs sm:text-sm text-brand-yellow font-bold">
            <Flame className="w-4 h-4 text-brand-pink fill-brand-pink" />
            <span>PURR-CENTAGE:</span>
          </div>
          <span className="font-heading text-2xl sm:text-3xl text-brand-lime font-bold tracking-wider">
            <PurrcentageCounter target={purrcentage} />
          </span>
          <span className="bg-black/70 text-brand-lime font-mono text-[9px] px-2 py-0.5 border border-brand-lime/40 uppercase tracking-wider font-semibold">
            GAME SCORE // FOR FUN
          </span>
        </motion.div>

        {/* Personality Blurb Sticker */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="w-full max-w-xl bg-[#1b1828] border-3 border-black p-3.5 shadow-hard-sm mb-5 rotate-[-0.5deg]"
        >
          <p className="font-meme text-sm sm:text-base text-gray-200 font-bold italic leading-relaxed">
            "{blurb}"
          </p>
        </motion.div>

        {/* Center: VS-Style Comparison */}
        <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 my-2">
          {/* User Snapshot Card */}
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 18,
              delay: 0.3,
            }}
            className="neo-card bg-[#181828] border-4 border-black p-3 sm:p-4 flex flex-col items-center shadow-hard rotate-[-1deg]"
          >
            <div className="flex items-center justify-between w-full mb-2 border-b-2 border-black pb-1.5">
              <span className="neo-badge bg-brand-lime text-black font-arcade text-xs">
                YOUR SNAPSHOT
              </span>
              <span className="font-mono text-[11px] text-gray-400">
                FROZEN FRAME
              </span>
            </div>

            <div className="relative w-full aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt={`Your captured facial expression: ${label}`}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 font-mono text-xs flex flex-col items-center justify-center p-4">
                  <span className="text-2xl mb-1">📸</span>
                  <span>NO FRAME CAPTURED</span>
                </div>
              )}
              <div className="absolute inset-0 crt-scanlines pointer-events-none" />
            </div>
          </motion.div>

          {/* Large Neon VS Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: -6 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 14,
              delay: 0.4,
            }}
            className="flex flex-col items-center justify-center select-none py-1"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-brand-yellow text-black border-4 border-black shadow-hard-lg rounded-full flex items-center justify-center transform hover:scale-110 transition-transform">
              <span className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-widest text-black drop-shadow-[2px_2px_0px_#FF2E93]">
                VS
              </span>
            </div>
          </motion.div>

          {/* Matched Real Cat Meme Card */}
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 18,
              delay: 0.3,
            }}
            className="neo-card bg-[#181828] border-4 border-black p-3 sm:p-4 flex flex-col items-center shadow-hard rotate-[1deg]"
          >
            <div className="flex items-center justify-between w-full mb-2 border-b-2 border-black pb-1.5">
              <span className="neo-badge bg-brand-pink text-white font-arcade text-xs">
                MATCHED CAT
              </span>
              <span className="font-mono text-[11px] text-brand-yellow font-bold">
                {purrcentage}% MATCH
              </span>
            </div>

            <div className="relative w-full aspect-[4/3] bg-black border-3 border-black overflow-hidden flex items-center justify-center">
              {catImageUrl ? (
                <img
                  src={catImageUrl}
                  alt={`Matched cat meme: ${catName}`}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="p-4 text-center text-gray-400 font-mono text-xs flex flex-col items-center justify-center h-full">
                  <span className="text-3xl mb-1">🐱</span>
                  <span>CAT MEME IMAGE UNAVAILABLE</span>
                </div>
              )}
              <div className="absolute inset-0 crt-scanlines pointer-events-none" />
            </div>

            {/* Cat Name & Caption */}
            <div className="w-full bg-[#12121d] border-2 border-black p-2 mt-2 text-center">
              <h4 className="font-heading text-lg sm:text-xl text-brand-pink leading-tight truncate">
                {catName}
              </h4>
              <p className="font-meme text-xs text-gray-300 font-bold italic mt-0.5 line-clamp-2">
                "{catCaption}"
              </p>
            </div>
          </motion.div>
        </div>

        {/* Watermark for image save */}
        <div className="text-[10px] font-arcade text-gray-500 mt-4 tracking-wider select-none">
          PURRSONALITY // YOUR FACE. YOUR VIBE. YOUR PURRSONALITY.
        </div>
      </div>

      {/* Save Error Notice */}
      {saveError && (
        <div className="w-full max-w-md mt-4 bg-[#2e121c] border-3 border-brand-pink p-3 text-center text-xs font-arcade text-brand-pink shadow-hard-sm flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-brand-pink" />
          <span>{saveError}. PLEASE TRY AGAIN!</span>
        </div>
      )}

      {/* Action Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 w-full max-w-3xl"
      >
        {/* Scan Again Button */}
        <button
          onClick={onScanAgain}
          aria-label="Return to live camera and scan again"
          className="neo-btn-pink text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer group flex items-center gap-2 min-h-[44px]"
        >
          <RotateCcw className="w-5 h-5 group-hover:-rotate-90 transition-transform" />
          <span>SCAN AGAIN</span>
        </button>

        {/* Copy Result Button */}
        <button
          onClick={handleCopy}
          aria-label="Copy result summary to clipboard"
          className="neo-btn-yellow text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer flex items-center gap-2 min-h-[44px]"
        >
          {copyStatus === "copied" ? (
            <>
              <Check className="w-5 h-5 text-black" />
              <span>COPIED! ✨</span>
            </>
          ) : copyStatus === "failed" ? (
            <>
              <AlertTriangle className="w-5 h-5 text-black" />
              <span>COULD NOT COPY</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-black" />
              <span>COPY RESULT</span>
            </>
          )}
        </button>

        {/* Save / Export Result Card Button */}
        <button
          onClick={handleSaveImage}
          disabled={isSaving}
          aria-label="Download result card image as PNG"
          className="neo-btn bg-brand-lime text-black text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer flex items-center gap-2 min-h-[44px] disabled:opacity-50"
        >
          <Download className={`w-5 h-5 ${isSaving ? "animate-bounce" : ""}`} />
          <span>{isSaving ? "SAVING..." : "SAVE RESULT"}</span>
        </button>
      </motion.div>
    </div>
  );
};
