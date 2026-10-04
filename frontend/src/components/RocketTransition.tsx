import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface RocketTransitionProps {
  onComplete: () => void;
}

export const RocketTransition: React.FC<RocketTransitionProps> = ({
  onComplete,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [stage, setStage] = useState<
    "prep" | "count3" | "count2" | "count1" | "blastoff" | "wipe"
  >("prep");

  // Reduced motion: immediate quick transition
  useEffect(() => {
    if (shouldReduceMotion) {
      const timer = setTimeout(() => {
        onComplete();
      }, 350);
      return () => clearTimeout(timer);
    }

    // Normal cinematic timeline (~2.1 seconds)
    const t1 = setTimeout(() => setStage("count3"), 450);
    const t2 = setTimeout(() => setStage("count2"), 850);
    const t3 = setTimeout(() => setStage("count1"), 1250);
    const t4 = setTimeout(() => setStage("blastoff"), 1550);
    const t5 = setTimeout(() => setStage("wipe"), 1900);
    const t6 = setTimeout(() => onComplete(), 2150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [shouldReduceMotion, onComplete]);

  // Reduced motion fallback UI
  if (shouldReduceMotion) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#0a0a0f] flex items-center justify-center font-heading text-4xl text-brand-lime"
      >
        <span>LAUNCHING SCANNER...</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 overflow-hidden bg-[#07070c]/95 backdrop-blur-md flex flex-col items-center justify-center select-none ${
        stage === "blastoff" ? "animate-[wiggle_0.1s_ease-in-out_infinite]" : ""
      }`}
    >
      {/* Background Speed Lines during Blastoff */}
      {stage === "blastoff" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: "120vh", opacity: [0, 0.8, 0] }}
              transition={{
                duration: 0.35,
                repeat: Infinity,
                delay: i * 0.04,
                ease: "linear",
              }}
              style={{ left: `${(i / 12) * 100}%` }}
              className="absolute w-1 h-32 bg-brand-yellow/80 shadow-[0_0_8px_#FFE600]"
            />
          ))}
        </div>
      )}

      {/* Floating Paw Sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {["🐾", "✨", "⚡", "🐾", "⭐"].map((symbol, idx) => (
          <motion.div
            key={idx}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0.8, 1.3, 0],
              opacity: [0, 0.9, 0],
              y: [-10, -70],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: idx * 0.25,
            }}
            className="absolute text-2xl"
            style={{
              left: `${20 + idx * 15}%`,
              top: `${40 + (idx % 3) * 15}%`,
            }}
          >
            {symbol}
          </motion.div>
        ))}
      </div>

      {/* Dynamic Launch Text Banner */}
      <div className="mb-6 z-20 text-center">
        {stage === "prep" && (
          <motion.div
            initial={{ scale: 0.6, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            className="inline-block bg-brand-yellow text-black font-arcade px-6 py-2.5 border-4 border-black text-sm md:text-lg shadow-hard-lg rotate-[-1deg]"
          >
            PURR-ARE FOR TAKEOFF! 🐾
          </motion.div>
        )}

        {(stage === "count3" || stage === "count2" || stage === "count1") && (
          <motion.div
            key={stage}
            initial={{ scale: 0.4, rotate: -15, opacity: 0 }}
            animate={{ scale: 1.2, rotate: 0, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 18 }}
            className="font-heading text-8xl md:text-9xl text-brand-pink drop-shadow-[6px_6px_0px_#000000]"
          >
            {stage === "count3" ? "3..." : stage === "count2" ? "2..." : "1..."}
          </motion.div>
        )}

        {stage === "blastoff" && (
          <motion.div
            initial={{ scale: 0.7, y: 10 }}
            animate={{ scale: 1.25, y: 0 }}
            className="inline-block bg-brand-pink text-white font-heading px-8 py-3 border-4 border-black text-3xl md:text-5xl shadow-hard-lg rotate-[2deg]"
          >
            MEOWBLAST! 🚀⚡
          </motion.div>
        )}
      </div>

      {/* Rocket and Cat Stage */}
      <div className="relative w-64 h-96 flex flex-col items-center justify-end z-10">
        {/* Cat Jumping Into Rocket Animation */}
        {stage === "prep" && (
          <motion.div
            initial={{ y: 80, x: -60, scale: 0.5, rotate: -25 }}
            animate={{
              y: [-10, -60, -25],
              x: [-40, -10, 0],
              scale: [0.8, 1.2, 0.9],
              rotate: [-20, 10, 0],
            }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute top-24 z-30 text-5xl filter drop-shadow-[3px_3px_0px_#000000]"
          >
            🐱
          </motion.div>
        )}

        {/* Cartoon Neo-Brutalist Rocket */}
        <motion.div
          animate={
            stage === "blastoff"
              ? {
                  y: -900,
                  scale: [1, 1.1, 0.9],
                  transition: { duration: 0.55, ease: [0.4, 0.0, 0.2, 1] },
                }
              : stage === "count1" || stage === "count2" || stage === "count3"
              ? {
                  y: [-3, 3, -3],
                  rotate: [-1.5, 1.5, -1.5],
                  transition: { repeat: Infinity, duration: 0.12 },
                }
              : { y: 0 }
          }
          className="relative flex flex-col items-center origin-bottom"
        >
          {/* Nose Cone */}
          <div
            className="w-16 h-20 bg-brand-pink border-4 border-black shadow-hard-sm"
            style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
          />

          {/* Rocket Fuselage Body */}
          <div className="w-24 h-36 bg-brand-purple border-4 border-black relative flex flex-col items-center justify-center shadow-hard">
            {/* Cockpit Window */}
            <div className="w-14 h-14 rounded-full bg-brand-lime border-4 border-black flex items-center justify-center overflow-hidden shadow-hard-sm">
              <span className="text-3xl select-none animate-pulse">🐱</span>
            </div>

            {/* Side Arcade Fins */}
            <div
              className="absolute -left-6 bottom-0 w-8 h-16 bg-brand-yellow border-4 border-black"
              style={{ clipPath: "polygon(100% 0%, 0% 100%, 100% 100%)" }}
            />
            <div
              className="absolute -right-6 bottom-0 w-8 h-16 bg-brand-yellow border-4 border-black"
              style={{ clipPath: "polygon(0% 0%, 100% 100%, 0% 100%)" }}
            />
          </div>

          {/* Rocket Thruster Nozzle */}
          <div className="w-14 h-6 bg-black border-2 border-brand-yellow" />

          {/* Animated Rocket Exhaust Flame */}
          {(stage === "blastoff" ||
            stage === "count1" ||
            stage === "count2") && (
            <motion.div
              animate={{
                scaleY: stage === "blastoff" ? [1.8, 2.5, 2.0] : [0.7, 1.2, 0.8],
                scaleX: [0.9, 1.1, 0.95],
              }}
              transition={{ repeat: Infinity, duration: 0.08 }}
              className="relative flex flex-col items-center origin-top -mt-1"
            >
              {/* Outer Flame (Hot Pink) */}
              <div
                className="w-16 h-28 bg-brand-pink border-3 border-black"
                style={{ clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" }}
              />
              {/* Inner Flame (Banana Yellow) */}
              <div
                className="absolute top-0 w-10 h-20 bg-brand-yellow"
                style={{ clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" }}
              />
              {/* Core Spark (Acid Lime) */}
              <div
                className="absolute top-0 w-5 h-10 bg-brand-lime"
                style={{ clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" }}
              />
            </motion.div>
          )}

          {/* Smoke Cloud Puffs during blastoff */}
          {stage === "blastoff" && (
            <div className="absolute -bottom-8 flex gap-2 pointer-events-none">
              <motion.div
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="w-12 h-12 bg-white rounded-full border-3 border-black"
              />
              <motion.div
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="w-14 h-14 bg-gray-200 rounded-full border-3 border-black"
              />
              <motion.div
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="w-10 h-10 bg-white rounded-full border-3 border-black"
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Screen Wipe Transition Sweep */}
      {stage === "wipe" && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-50 bg-brand-lime origin-bottom border-t-8 border-black flex items-center justify-center"
        >
          <span className="font-heading text-6xl text-black rotate-[-3deg]">
            CAT SCANNING ENGAGED! ⚡
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};
