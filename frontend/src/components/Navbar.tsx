import React from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export const Navbar: React.FC = () => {
  const { currentScreen, setScreen, isMuted, toggleMute, isLaunching } =
    useAppStore();

  return (
    <header className="w-full bg-[#12121c] border-b-4 border-black px-4 py-3 sticky top-0 z-40 select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: 🐱 PURRSONALITY Wordmark with animated cat ear/tail */}
        <button
          onClick={() => {
            if (!isLaunching) setScreen("landing");
          }}
          disabled={isLaunching}
          className="flex items-center gap-2.5 text-left cursor-pointer focus:outline-none group disabled:opacity-70"
          aria-label="Purrsonality Home"
        >
          {/* Animated Cat Icon with Wagging Tail / Twitching Ears */}
          <div className="relative flex items-center justify-center">
            <motion.span
              animate={{ rotate: [-4, 6, -4] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              className="text-3xl inline-block"
            >
              🐱
            </motion.span>
            {/* Animated Cat Tail Spark */}
            <motion.span
              animate={{ rotate: [-20, 20, -20] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="absolute -top-1 -right-1 text-xs origin-bottom-left pointer-events-none"
            >
              ✨
            </motion.span>
          </div>

          <span className="font-heading text-3xl md:text-4xl tracking-wider text-brand-pink leading-none drop-shadow-[2px_2px_0px_#000000]">
            PURRSONALITY
          </span>
        </button>

        {/* Right: Sound Control and Home/Back Button when on scan screen */}
        <div className="flex items-center gap-3">
          {currentScreen === "scan" && (
            <button
              onClick={() => setScreen("landing")}
              className="px-3.5 py-1.5 text-xs font-bold font-mono uppercase bg-white text-black border-3 border-black shadow-hard-sm hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer transition-transform"
              aria-label="Return to home landing page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>HOME</span>
            </button>
          )}

          {/* Sound / Mute Toggle */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            className="p-2 bg-[#202030] text-white border-3 border-black shadow-hard-sm hover:bg-[#2b2b3f] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-brand-pink" />
            ) : (
              <Volume2 className="w-4 h-4 text-brand-lime" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
