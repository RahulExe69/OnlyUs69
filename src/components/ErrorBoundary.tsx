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
    // Do not clear all session storage: other app flows may keep transient state there.
    // Use a one-shot recovery marker so a broken chunk cannot trap the user in a
    // reload loop when the deployed bundle is still inconsistent.
    const key = 'onlyus_chunk_recovery_attempt';
    try {
      const lastAttempt = Number(sessionStorage.getItem(key) || '0');
      const now = Date.now();
      if (lastAttempt && now - lastAttempt < 60_000) {
        // A fresh load already failed recently. Stop retrying and leave the real
        // error visible instead of repeatedly showing a misleading update prompt.
        this.setState({
          hasError: true,
          error: new Error('The latest app bundle could not be loaded. Please try again after the deployment finishes.')
        });
        return;
      }
      sessionStorage.setItem(key, String(now));
    } catch (e) {
      console.warn('Could not persist chunk-recovery state:', e);
    }

    // A query marker forces a distinct navigation request while preserving the
    // current path and existing query parameters. It is intentionally not a cache
    // purge and does not remove auth/session data.
    const url = new URL(window.location.href);
    url.searchParams.set('__onlyus_recover', String(Date.now()));
    window.location.replace(url.toString());
  };

  public override render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || '';
      const isChunkLoadError =
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Importing a module script failed') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('is not a valid JavaScript MIME type') ||
        errorMsg.includes('latest app bundle could not be loaded');

      if (!isChunkLoadError) {
        return (
          <div className="min-h-screen bg-[var(--theme-bg,#FFF0F3)] text-[var(--theme-text,#1a1a1a)] flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="w-full max-w-sm bg-white/90 rounded-3xl p-6 shadow-xl border border-[#FFCCD5]">
              <h2 className="text-lg font-bold text-[#590D22] mb-2">Something went wrong</h2>
              <p className="text-sm text-[#6E6E6E] mb-4">The app encountered an error that a reload may not fix.</p>
              <button onClick={() => window.location.reload()} className="w-full py-3 px-4 rounded-2xl bg-[#FF4D6D] text-white font-bold text-sm">Reload app</button>
            </div>
          </div>
        );
      }

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
