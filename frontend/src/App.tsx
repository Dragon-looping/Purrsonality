import React from "react";
import { useAppStore } from "./store/useAppStore";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { ScanScreen } from "./pages/ScanScreen";

export const App: React.FC = () => {
  const { currentScreen } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
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
