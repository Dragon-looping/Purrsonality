import React from "react";
import { useAppStore } from "./store/useAppStore";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { ScanScreen } from "./pages/ScanScreen";
import { CustomCursor } from "./components/CustomCursor";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const App: React.FC = () => {
  const { currentScreen } = useAppStore();

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
        {/* Cat-Themed Custom Cursor */}
        <CustomCursor />

        {/* Neo-brutalist Header */}
        <Navbar />

        {/* Screen Router with ErrorBoundary */}
        <div className="flex-grow">
          <ErrorBoundary>
            {currentScreen === "landing" ? <LandingPage /> : <ScanScreen />}
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
