'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const message = error?.message || error?.toString() || '';
    const isChunk = /Loading chunk .* failed/i.test(message) || /ChunkLoadError/i.test(message);
    return {
      hasError: true,
      error,
      isChunkError: isChunk
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component tree:', error, errorInfo);

    // Auto-reload on chunk load failures to immediately resolve version mismatches
    const message = error?.message || error?.toString() || '';
    const isChunk = /Loading chunk .* failed/i.test(message) || /ChunkLoadError/i.test(message);

    if (isChunk && typeof window !== 'undefined') {
      const reloadKey = 'chunk_reload_attempt';
      const lastAttempt = Number(sessionStorage.getItem(reloadKey) || '0');
      const now = Date.now();
      // Allow one auto-reload per 10 seconds to break cache safely without looping
      if (now - lastAttempt > 10000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }

  private handleManualReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div id="error-boundary-screen" className="min-h-screen bg-[#F3F8F7] text-slate-800 flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-700">
              {this.state.isChunkError ? (
                <RefreshCw size={24} className="animate-spin" />
              ) : (
                <AlertCircle size={24} className="text-amber-700" />
              )}
            </div>

            <h2 className="text-base font-bold text-slate-800 mb-1 tracking-tight">
              {this.state.isChunkError ? 'Updating Application Resources' : 'Something went wrong'}
            </h2>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {this.state.isChunkError
                ? 'A new build or code update was deployed. The workspace is synchronizing with the latest bundle.'
                : (this.state.error?.message || 'An unexpected rendering error occurred in the dashboard.')}
            </p>

            <div className="flex items-center gap-3 w-full">
              <button
                id="error-reload-btn"
                type="button"
                onClick={this.handleManualReload}
                className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0C] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>

              {!this.state.isChunkError && (
                <button
                  id="error-retry-btn"
                  type="button"
                  onClick={this.handleReset}
                  className="py-2.5 px-4 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-700 text-xs rounded-lg transition-colors font-sans"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
