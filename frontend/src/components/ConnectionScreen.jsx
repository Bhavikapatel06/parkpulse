import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Activity } from 'lucide-react';
import { pingServer } from '../lib/api';

/**
 * Soft, minimal, and clean screen displayed while connecting to the live server.
 */
export function ConnectionEstablishingScreen({ onConnected, onManualRetry }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPinging, setIsPinging] = useState(false);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Background auto-reconnect ping
  useEffect(() => {
    let isMounted = true;

    const interval = setInterval(async () => {
      if (isPinging) return;
      setIsPinging(true);

      const isHealthy = await pingServer(5000);
      if (isMounted) {
        setIsPinging(false);
        if (isHealthy && onConnected) {
          onConnected();
        }
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isPinging, onConnected]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 bg-background">
      <div className="glass-panel w-full max-w-md p-8 sm:p-10 border border-slate-700/40 rounded-2xl shadow-xl flex flex-col items-center text-center">
        {/* Soft pulse icon */}
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        </div>

        {/* Primary minimal message */}
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
          Establishing connection...
        </h2>
        
        <p className="text-slate-300 text-sm mb-4 leading-relaxed">
          Please wait while we establish the connection.
        </p>

        {/* Minimal soft status hint */}
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3.5 py-1.5 rounded-full border border-slate-700/50 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Waking up server ({elapsedSeconds}s)</span>
        </div>

        {/* Subtle manual retry if taking longer */}
        {elapsedSeconds > 15 && (
          <button
            onClick={onManualRetry}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Retry now</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Soft, minimal screen if connection fails.
 */
export function ConnectionErrorScreen({ onRetry }) {
  const [countdown, setCountdown] = useState(6);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    if (onRetry) onRetry();
    setTimeout(() => setIsRetrying(false), 2000);
  }, [onRetry]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleRetry();
          return 6;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleRetry]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px] p-6">
      <div className="glass-panel p-8 flex flex-col items-center justify-center text-center max-w-md border border-slate-700/50 rounded-2xl shadow-xl">
        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 border border-amber-500/20 text-amber-400">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">
          Connecting to server...
        </h3>
        
        <p className="text-slate-300 text-sm mb-6">
          The server is still starting up. Auto-retrying in <span className="font-semibold text-blue-400 font-mono">{countdown}s</span>.
        </p>

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Connecting...' : 'Retry Connection'}</span>
        </button>
      </div>
    </div>
  );
}
