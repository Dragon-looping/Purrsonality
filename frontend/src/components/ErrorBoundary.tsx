import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Purrsonality ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 text-center select-none bg-noise">
          <div className="w-20 h-20 bg-brand-pink text-white border-4 border-black flex items-center justify-center shadow-hard mb-5 rotate-[-3deg]">
            <AlertTriangle className="w-10 h-10 text-black" />
          </div>
          <div className="inline-block bg-brand-yellow text-black font-arcade text-xs px-3 py-1 border-3 border-black shadow-hard-sm mb-3">
            SYSTEM HICCUP
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl text-brand-pink mb-3">
            THE CATS TRIPPED OVER A WIRE
          </h1>
          <p className="font-meme text-base sm:text-lg text-gray-300 max-w-md mb-8 font-bold">
            Something unexpected occurred in the cat council simulation.
            Don't worry, your nine lives are still intact!
          </p>
          <button
            onClick={this.handleReset}
            className="neo-btn-lime text-lg px-8 py-3.5 border-4 border-black shadow-hard hover:shadow-hard-lg transition-transform active:translate-x-1 active:translate-y-1 cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5 mr-1" />
            <span>RESTART PURRSONALITY</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
