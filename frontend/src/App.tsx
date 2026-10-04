import React from "react";
import { useAppStore } from "./store/useAppStore";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { ScanScreen } from "./pages/ScanScreen";
import { CustomCursor } from "./components/CustomCursor";

export const App: React.FC = () => {
  const { currentScreen } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
      {/* Cat-Themed Custom Cursor */}
      <CustomCursor />

      {/* Neo-brutalist Header */}
      <Navbar />

      {/* Screen Router */}
      <div className="flex-grow">
        {currentScreen === "landing" ? <LandingPage /> : <ScanScreen />}
      </div>
    </div>
  );
};

export default App;
