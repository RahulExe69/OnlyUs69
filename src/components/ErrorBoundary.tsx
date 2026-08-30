import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Heart } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("OnlyUs Caught Error:", error, errorInfo);
    
    // Auto-recover if chunk/module load error occurred
    const errorMsg = error?.message || '';
    if (
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('Importing a module script failed') ||
      errorMsg.includes('Loading chunk') ||
      errorMsg.includes('is not a valid JavaScript MIME type')
    ) {
      const lastReload = sessionStorage.getItem('onlyus_auto_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('onlyus_auto_reload', now.toString());
        window.location.reload();
      }
    }
  }

  private handleHardRefresh = () => {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn(e);
    }
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF0F3] text-[#1a1a1a] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-full max-w-sm bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-[#FFCCD5] flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF8FA3] to-[#FF4D6D] text-white flex items-center justify-center shadow-md mb-4">
              <Heart className="w-7 h-7 fill-current" />
            </div>

            <h2 className="text-lg font-bold text-[#590D22] mb-1">New Version Sync</h2>
            <p className="text-xs text-[#6E6E6E] mb-6 leading-relaxed">
              A new update was just deployed. Tap below to sync to the latest version.
            </p>

            <button
              onClick={this.handleHardRefresh}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF758F] to-[#FF4D6D] text-white font-bold text-sm shadow-md shadow-pink-500/25 active:scale-95 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Update & Load App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
