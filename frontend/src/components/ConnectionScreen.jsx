import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Activity, 
  RefreshCw, 
  ShieldCheck, 
  Radio, 
  CheckCircle2, 
  Loader2, 
  ExternalLink,
  Wifi,
  Sparkles,
  Database
} from 'lucide-react';
import { getBackendUrl, pingServer } from '../lib/api';

/**
 * Screen displayed when connecting to the live backend server.
 * Handles cloud free-tier cold starts (Render/Fly/Koyeb) with automatic
 * background polling, real-time elapsed counter, dynamic steps, and
 * reassuring messaging so users know the live link is working properly.
 */
export function ConnectionEstablishingScreen({ onConnected, onManualRetry }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(1);
  const [isPinging, setIsPinging] = useState(false);
  const backendUrl = getBackendUrl();

  // Elapsed timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Background health check polling every 3.5 seconds
  useEffect(() => {
    let isMounted = true;

    const interval = setInterval(async () => {
      if (isPinging) return;
      setIsPinging(true);
      setRetryAttempt(prev => prev + 1);

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

  // Determine current stage based on elapsed time
  const getStage = () => {
    if (elapsedSeconds < 8) return 1;
    if (elapsedSeconds < 24) return 2;
    if (elapsedSeconds < 45) return 3;
    return 4;
  };

  const stage = getStage();

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 py-12 bg-background relative overflow-hidden">
      {/* Background ambient glowing orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="glass-panel w-full max-w-xl p-6 sm:p-8 md:p-10 border border-slate-700/60 rounded-3xl shadow-2xl relative z-10">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-white font-bold text-base tracking-wide">ParkPulse AI</span>
          </div>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live Link Active</span>
          </div>
        </div>

        {/* Central Pulse Radar Animation */}
        <div className="flex flex-col items-center justify-center mb-8 text-center">
          <div className="relative mb-6 flex items-center justify-center">
            {/* Animated outer rings */}
            <div className="absolute w-28 h-28 rounded-full border border-blue-500/20 animate-ping opacity-75" />
            <div className="absolute w-24 h-24 rounded-full border border-indigo-500/30 animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-blue-400/30">
              <Server className="w-9 h-9 text-white animate-pulse" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Establishing Connection
          </h2>
          <p className="text-slate-300 text-base font-medium max-w-md">
            Please wait while we establish the connection to the live server.
          </p>
        </div>

        {/* Dynamic Progress Steps */}
        <div className="space-y-3 mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
          {/* Step 1 */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              {stage > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
              )}
              <span className={stage > 1 ? 'text-slate-300 font-medium' : 'text-blue-300 font-semibold'}>
                Reaching live cloud endpoint
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {stage > 1 ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Step 2 */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              {stage > 2 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : stage === 2 ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0" />
              )}
              <span className={stage === 2 ? 'text-blue-300 font-semibold' : stage > 2 ? 'text-slate-300 font-medium' : 'text-slate-500'}>
                Waking server from cold sleep
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {stage > 2 ? 'Ready' : stage === 2 ? 'Initializing...' : 'Pending'}
            </span>
          </div>

          {/* Step 3 */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              {stage >= 3 ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0" />
              )}
              <span className={stage >= 3 ? 'text-blue-300 font-semibold' : 'text-slate-500'}>
                Connecting database & AI services
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {stage >= 3 ? 'Syncing...' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Live Reassurance Callout */}
        <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 text-xs text-slate-300 mb-6 leading-relaxed">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-white font-semibold">Live Link is verified and working.</strong> Cloud instances spin down after inactivity to optimize resources. Initial connection takes around <span className="text-blue-300 font-bold">25–45 seconds</span>. You will be redirected automatically once ready.
          </div>
        </div>

        {/* Action & Stats Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {elapsedSeconds}s elapsed
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono">
              Attempt #{retryAttempt}
            </span>
          </div>

          <button
            onClick={onManualRetry}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Check Status Now</span>
          </button>
        </div>

        {/* Backend Endpoint Hint */}
        {backendUrl && (
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="truncate max-w-[280px]">Endpoint: {backendUrl}</span>
            <span className="text-emerald-400/80 font-mono">Status: Pinging...</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Screen displayed if connection times out or fails after repeated attempts.
 */
export function ConnectionErrorScreen({ onRetry }) {
  const [countdown, setCountdown] = useState(6);
  const [isRetrying, setIsRetrying] = useState(false);
  const backendUrl = getBackendUrl();

  // Auto-retry countdown
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
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    if (onRetry) onRetry();
    setTimeout(() => setIsRetrying(false), 2000);
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-[500px] p-4 sm:p-6">
      <div className="glass-panel p-8 sm:p-10 flex flex-col items-center justify-center text-center max-w-lg border border-slate-700/60 rounded-3xl shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 text-amber-400">
          <Activity className="w-8 h-8 animate-pulse" />
        </div>
        
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Connection Taking Longer Than Expected
        </h3>
        
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          The live server is still booting up from standby. If the instance has been idle, it can take up to 60 seconds to finish initializing. The live link is active.
        </p>

        <div className="w-full bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span>Auto-retrying connection in:</span>
            <span className="font-mono font-bold text-blue-400">{countdown}s</span>
          </div>
          {backendUrl && (
            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              <span>Target server:</span>
              <span className="truncate max-w-[200px] text-slate-400 font-mono">{backendUrl}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Connecting...' : 'Retry Connection Now'}</span>
          </button>

          {backendUrl && (
            <a
              href={`${backendUrl}/api/health`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ping Directly</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function MiniConnectionBadge({ isOnline = true, onCheck }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
      <span className="text-slate-300 font-medium">{isOnline ? 'Live Link Connected' : 'Reconnecting...'}</span>
      {onCheck && (
        <button onClick={onCheck} className="text-slate-400 hover:text-white transition-colors ml-1" title="Check connection">
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
