import React from "react";
import { motion } from "framer-motion";
import { Camera, Sparkles, Zap, Flame, ShieldCheck } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { RocketTransition } from "../components/RocketTransition";

export const LandingPage: React.FC = () => {
  const { setScreen, isLaunching, setIsLaunching, resetScan } = useAppStore();

  const handleStartScan = () => {
    if (isLaunching) return;
    resetScan();
    setIsLaunching(true);
  };

  const handleLaunchComplete = () => {
    resetScan();
    setIsLaunching(false);
    setScreen("scan");
  };

  // Controlled floating meme stickers
  const floatingStickers = [
    { emoji: "🐱", x: "8%", y: "16%", delay: 0.1, rotate: "-12deg" },
    { emoji: "⚡", x: "89%", y: "18%", delay: 0.2, rotate: "15deg" },
    { emoji: "🐟", x: "10%", y: "78%", delay: 0.3, rotate: "22deg" },
    { emoji: "🍣", x: "88%", y: "75%", delay: 0.4, rotate: "-18deg" },
    { emoji: "🙀", x: "92%", y: "45%", delay: 0.5, rotate: "10deg" },
    { emoji: "🧶", x: "6%", y: "48%", delay: 0.2, rotate: "-15deg" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-hidden bg-noise">
      {/* Purr Launch Cinematic Rocket Overlay */}
      {isLaunching && <RocketTransition onComplete={handleLaunchComplete} />}

      {/* Floating Cat & Meme Emojis */}
      {floatingStickers.map((item, idx) => (
        <motion.div
          key={idx}
          className="absolute text-3xl md:text-5xl select-none pointer-events-none z-0"
          style={{ left: item.x, top: item.y }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [1, 1.15, 1],
            rotate: [item.rotate, `${parseInt(item.rotate) + 10}deg`, item.rotate],
            opacity: 0.75,
          }}
          transition={{
            duration: 3.5 + idx * 0.5,
            repeat: Infinity,
            repeatType: "reverse",
            delay: item.delay,
          }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Main Hero Container */}
      <main className="max-w-4xl mx-auto px-4 pt-12 pb-16 text-center z-10 flex flex-col items-center justify-center flex-grow">
        {/* Cat Ears Top Header */}
        <motion.div
          initial={{ y: -25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative inline-block mb-3"
        >
          {/* Animated SVG Cat Ears */}
          <div className="absolute -top-10 md:-top-14 left-1/2 -translate-x-1/2 w-48 md:w-60 flex justify-between pointer-events-none">
            {/* Left Ear */}
            <motion.div
              animate={{ rotate: [-6, 2, -6] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="w-12 h-14 md:w-16 md:h-18 bg-brand-pink border-4 border-black rotate-[-12deg] shadow-hard-sm origin-bottom"
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
            >
              <div
                className="w-full h-full bg-brand-lime scale-50 translate-y-3"
                style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
              />
            </motion.div>

            {/* Right Ear */}
            <motion.div
              animate={{ rotate: [6, -2, 6] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: 0.2 }}
              className="w-12 h-14 md:w-16 md:h-18 bg-brand-pink border-4 border-black rotate-[12deg] shadow-hard-sm origin-bottom"
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
            >
              <div
                className="w-full h-full bg-brand-lime scale-50 translate-y-3"
                style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
              />
            </motion.div>
          </div>

          {/* Quirky Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-yellow text-black px-4 py-1 border-3 border-black font-arcade text-xs md:text-sm shadow-hard-sm rotate-[-2deg]">
            <Sparkles className="w-3.5 h-3.5 text-black" />
            REAL-TIME FACE-TO-CAT MEME SCANNER
            <Flame className="w-3.5 h-3.5 text-brand-pink fill-brand-pink" />
          </div>
        </motion.div>

        {/* Giant PURRSONALITY Wordmark */}
        <motion.h1
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="font-heading text-6xl sm:text-7xl md:text-9xl text-white tracking-wider leading-none drop-shadow-[6px_6px_0px_#000000] glitch-text select-none cursor-default"
        >
          <span className="text-brand-pink">PURR</span>
          <span className="text-brand-lime">SON</span>
          <span className="text-brand-yellow">ALITY</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="font-arcade text-xl sm:text-2xl md:text-3xl text-brand-lime mt-4 mb-2 drop-shadow-[2px_2px_0px_#000000] tracking-wide"
        >
          Your face. Your vibe. Your Purrsonality.
        </motion.p>

        {/* Clear, focused description */}
        <motion.p
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="font-body text-base sm:text-lg text-gray-300 max-w-lg mb-8 font-medium"
        >
          Real-time face-to-cat meme matching! Smile, gasp, squint, or snooze—watch your matching feline alter-ego update live on screen.
        </motion.p>

        {/* Primary CTA Button */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
          whileHover={{ scale: isLaunching ? 1 : 1.05 }}
          whileTap={{ scale: isLaunching ? 1 : 0.95 }}
        >
          <button
            onClick={handleStartScan}
            disabled={isLaunching}
            aria-label="Start live continuous cat meme comparison"
            className="neo-btn-pink text-xl sm:text-2xl md:text-3xl px-8 py-5 border-4 border-black shadow-hard-lg hover:shadow-hard-xl transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Camera className="w-7 h-7 sm:w-8 sm:h-8 group-hover:rotate-12 transition-transform" />
            <span>START LIVE MATCH</span>
            <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-brand-yellow fill-brand-yellow" />
          </button>
        </motion.div>

        {/* 3 Step Sticker Cards */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-14 max-w-3xl w-full text-left"
        >
          {/* Step 1 */}
          <div className="neo-card bg-[#1a162b] border-4 border-black shadow-hard rotate-[-1.5deg] hover:rotate-0 transition-transform">
            <span className="neo-badge bg-brand-lime text-black mb-2">STEP 1</span>
            <h3 className="font-heading text-2xl text-brand-yellow mt-1">CAMERA ON</h3>
            <p className="font-body text-xs text-gray-300 mt-1">
              Position your face in front of the lens. The continuous CV sensor locks onto your features.
            </p>
          </div>

          {/* Step 2 */}
          <div className="neo-card bg-[#231520] border-4 border-black shadow-hard rotate-[1deg] hover:rotate-0 transition-transform">
            <span className="neo-badge bg-brand-pink text-white mb-2">STEP 2</span>
            <h3 className="font-heading text-2xl text-brand-pink mt-1">MAKE FACES</h3>
            <p className="font-body text-xs text-gray-300 mt-1">
              Smile, drop your jaw, squint, or stay deadpan. Watch your facial telemetry react live.
            </p>
          </div>

          {/* Step 3 */}
          <div className="neo-card bg-[#14231b] border-4 border-black shadow-hard rotate-[-1deg] hover:rotate-0 transition-transform">
            <span className="neo-badge bg-brand-yellow text-black mb-2">STEP 3</span>
            <h3 className="font-heading text-2xl text-brand-lime mt-1">LIVE CAT TWIN</h3>
            <p className="font-body text-xs text-gray-300 mt-1">
              Your cat meme twin updates continuously side-by-side in real time as your mood shifts!
            </p>
          </div>
        </motion.div>

        {/* Privacy Note */}
        <p className="text-[11px] font-mono text-gray-500 mt-8 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-lime" />
          Camera analysis runs client-side in your browser. No personal photos are stored.
        </p>
      </main>
    </div>
  );
};
