import React from 'react';

/**
 * Reusable skeleton loader with shimmer animation.
 * Uses the shimmer keyframe defined in index.css
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-700/40 ${className}`} />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="glass-panel p-5 flex items-center justify-between">
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-slate-700/60 animate-pulse" />
        <div className="h-7 w-16 rounded bg-slate-600/50 animate-pulse" />
      </div>
      <div className="w-10 h-10 rounded-lg bg-slate-700/60 animate-pulse" />
    </div>
  );
}

export function SkeletonChart({ height = 'h-[400px]' }) {
  return (
    <div className="glass-panel p-6">
      <div className="h-5 w-40 rounded bg-slate-700/60 animate-pulse mb-6" />
      <div className={`w-full ${height} rounded-lg bg-slate-700/30 animate-pulse flex items-end gap-2 px-4 pb-4`}>
        {[60, 40, 80, 55, 70, 45, 90, 35, 65, 50, 75, 48].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-slate-600/40 animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
        >
          Retry
        </button>
      )}
    </div>
  );
}
