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
} from "lucide-react";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import type { PredictResponse } from "../api/predict";
import { getCatImageUrl } from "../api/predict";
import { getExpressionBlurb } from "../config/theme";

interface ResultViewProps {
  predictResult: PredictResponse;
  capturedImage: string | null;
  onScanAgain: () => void;
}

const PurrcentageCounter: React.FC<{ target: number }> = ({ target }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200;
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
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFlash, setShowFlash] = useState(true);
  const exportCardRef = useRef<HTMLDivElement>(null);

  const activePrediction = predictResult.predictions[0];
  const cat = predictResult.cat;
  const label = activePrediction?.label || "Unknown";
  const catName = cat?.name || `${label} Cat`;
  const catCaption = cat?.caption || "Living my best nine lives.";
  const catImageUrl = getCatImageUrl(cat);
  const purrcentage = Math.round((activePrediction?.confidence || 0.95) * 100);
  const blurb = getExpressionBlurb(label);

  // Trigger screen flash and confetti on dramatic reveal
  useEffect(() => {
    // Fade out screen flash
    const flashTimer = setTimeout(() => setShowFlash(false), 350);

    // Launch arcade celebration confetti
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#FF2E93", "#C6FF00", "#FFE600", "#7B2FFF"],
      });
    } catch {
      // Fallback
    }

    return () => clearTimeout(flashTimer);
  }, []);

  const handleCopy = async () => {
    const text = `I got ${label.toUpperCase()} on Purrsonality 🐱\nCat match: ${catName}\nPurrcentage: ${purrcentage}%`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleSaveImage = async () => {
    if (!exportCardRef.current || isSaving) return;
    setIsSaving(true);
    try {
      const dataUrl = await toPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#141420",
      });
      const link = document.createElement("a");
      link.download = `purrsonality-${label.toLowerCase()}-result.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export result card image:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* 1. Dramatic Screen Flash Overlay */}
      {showFlash && (
        <motion.div
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 bg-white z-50 pointer-events-none"
        />
      )}

      {/* 2. Main Exportable Result Card Container */}
      <div
        ref={exportCardRef}
        className="w-full max-w-3xl flex flex-col items-center p-3 sm:p-5 md:p-6 bg-[#141420] border-4 border-black shadow-hard-xl rounded-none text-center"
      >
        {/* TOP: Header Banner */}
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

        {/* MAIN: YOU ARE: [EXPRESSION] */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 18,
            delay: 0.1,
          }}
          className="mb-3"
        >
          <span className="font-arcade text-xs sm:text-sm text-brand-lime tracking-widest block mb-0.5">
            YOU ARE:
          </span>
          <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl text-white tracking-wider leading-none drop-shadow-[4px_4px_0px_#000000]">
            <span className="text-brand-pink underline decoration-brand-yellow decoration-4 underline-offset-4">
              {label.toUpperCase()}
            </span>
          </h1>
        </motion.div>

        {/* PURR-CENTAGE SCORE BADGE */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 16,
            delay: 0.2,
          }}
          className="mb-4 inline-flex items-center gap-3 bg-[#1d1d2e] border-3 border-black px-4 py-1.5 shadow-hard-sm rotate-[1.5deg]"
        >
          <div className="flex items-center gap-1.5 font-arcade text-xs sm:text-sm text-brand-yellow font-bold">
            <Flame className="w-4 h-4 text-brand-pink fill-brand-pink" />
            <span>PURR-CENTAGE:</span>
          </div>
          <span className="font-heading text-2xl sm:text-3xl text-brand-lime font-bold tracking-wider">
            <PurrcentageCounter target={purrcentage} />
          </span>
        </motion.div>

        {/* PERSONALITY BLURB STICKER */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="w-full max-w-xl bg-[#1b1828] border-3 border-black p-3 shadow-hard-sm mb-5 rotate-[-0.5deg]"
        >
          <p className="font-meme text-sm sm:text-base text-gray-200 font-bold italic leading-relaxed">
            "{blurb}"
          </p>
        </motion.div>

        {/* CENTER: VS-STYLE COMPARISON (RESPONSIVE: SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 my-2">
          {/* Left: User Snapshot Card */}
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
                  alt="Your Captured Face"
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 font-mono text-xs">
                  No frame captured
                </div>
              )}
              <div className="absolute inset-0 crt-scanlines pointer-events-none" />
            </div>
          </motion.div>

          {/* Center: Large Neon VS Badge */}
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

          {/* Right: Matched Real Cat Meme Card */}
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
                  alt={catName}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-4 text-center text-gray-400 font-mono text-xs">
                  No local cat image found
                </div>
              )}
              <div className="absolute inset-0 crt-scanlines pointer-events-none" />
            </div>

            {/* Cat Name & Caption */}
            <div className="w-full bg-[#12121d] border-2 border-black p-2 mt-2 text-center">
              <h4 className="font-heading text-lg sm:text-xl text-brand-pink leading-tight">
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

      {/* 3. Action Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 w-full max-w-3xl"
      >
        {/* Scan Again Button */}
        <button
          onClick={onScanAgain}
          className="neo-btn-pink text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer group flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5 group-hover:-rotate-90 transition-transform" />
          <span>SCAN AGAIN</span>
        </button>

        {/* Copy Result Button */}
        <button
          onClick={handleCopy}
          className="neo-btn-yellow text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer flex items-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-black" />
              <span>COPIED! ✨</span>
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
          className="neo-btn bg-brand-lime text-black text-base sm:text-lg px-6 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          <Download className={`w-5 h-5 ${isSaving ? "animate-bounce" : ""}`} />
          <span>{isSaving ? "SAVING..." : "SAVE RESULT"}</span>
        </button>
      </motion.div>
    </div>
  );
};
