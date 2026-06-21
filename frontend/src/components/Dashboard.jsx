import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { AlertTriangle, MapPin, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { SkeletonStatCard, ErrorBanner } from './SkeletonCard';

/** Format any number with locale-aware thousands separators. */
function fmt(value) {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value; // e.g. area names
  return new Intl.NumberFormat('en-IN').format(value);
}

export default function Dashboard({ filters, uploadKey }) {
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }
    const qs = params.toString();

    Promise.all([
      api.get(`/api/dashboard?${qs}`),
      api.get(`/api/recommendations?${qs}`)
    ])
      .then(([dashRes, recRes]) => {
        setStats(dashRes.data);
        setRecommendations(recRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
        setLoading(false);
      });
  }, [filters, uploadKey]); // re-fetch whenever filters change OR a new file is uploaded

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Command Center Overview</h1>

      {/* Error State */}
      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} onRetry={fetchData} />
        </div>
      )}

      {/* Stat Cards — Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : stats ? (
          <>
            <StatCard
              title="Total Violations"
              value={stats.totalViolations}
              icon={<Activity />}
              color="blue"
            />
            <StatCard
              title="Approved"
              value={stats.approvedViolations}
              icon={<CheckCircle />}
              color="green"
            />
            <StatCard
              title="Rejected"
              value={stats.rejectedViolations}
              icon={<XCircle />}
              color="red"
            />
            <StatCard
              title="Pending"
              value={stats.pendingViolations}
              icon={<Clock />}
              color="yellow"
            />
            <StatCard
              title="Active Hotspots"
              value={stats.activeHotspots}
              icon={<MapPin />}
              color="orange"
            />
            <StatCard
              title="Highest Risk Area"
              value={stats.highestRiskArea ?? '—'}
              icon={<AlertTriangle />}
              color="red"
              isText
            />
          </>
        ) : null}
      </div>

      {/* Recommendations */}
      <h2 className="text-xl font-bold text-white mb-4">Actionable Insights</h2>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-panel p-6 border-l-4 border-l-slate-700">
              <div className="h-4 w-32 rounded bg-slate-700/60 animate-pulse mb-3" />
              <div className="h-3 w-full rounded bg-slate-700/40 animate-pulse mb-2" />
              <div className="h-3 w-4/5 rounded bg-slate-700/40 animate-pulse" />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass-panel p-10 text-center text-slate-500 text-sm">
          No recommendations available for the current filter selection.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((rec, idx) => (
            <div key={idx} className="glass-panel p-6 border-l-4 border-l-blue-500 hover:scale-[1.02] transition-transform">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-white leading-tight">{rec.location}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ml-2 ${rec.risk > 80 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  Risk: {rec.risk}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{rec.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Color themes for each card type.
 * Each maps to: icon color, icon bg, left border accent, value text color.
 */
const COLOR_THEMES = {
  blue:   { icon: 'text-blue-400',   bg: 'bg-blue-500/15 border border-blue-500/30',   value: 'text-blue-300' },
  green:  { icon: 'text-emerald-400', bg: 'bg-emerald-500/15 border border-emerald-500/30', value: 'text-emerald-300' },
  red:    { icon: 'text-red-400',     bg: 'bg-red-500/15 border border-red-500/30',     value: 'text-red-300' },
  yellow: { icon: 'text-amber-400',   bg: 'bg-amber-500/15 border border-amber-500/30', value: 'text-amber-300' },
  orange: { icon: 'text-orange-400',  bg: 'bg-orange-500/15 border border-orange-500/30', value: 'text-orange-300' },
};

/**
 * StatCard — displays a metric. Numbers are never truncated.
 * isText = true for area names (wraps naturally).
 */
function StatCard({ title, value, icon, color = 'blue', isText = false }) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;

  const displayValue = isText
    ? (value || '—')
    : (value !== undefined && value !== null && value !== ''
        ? Number(value).toLocaleString()
        : '—');

  return (
    <div className="glass-panel p-4 flex flex-col gap-3 min-w-0 w-full">
      {/* Top row: icon badge */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.bg}`}>
        {React.cloneElement(icon, { className: `w-5 h-5 ${theme.icon}` })}
      </div>
      {/* Bottom row: label + value */}
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-medium mb-1">{title}</p>
        <p
          className={`font-bold leading-tight ${
            isText
              ? 'text-sm text-white break-words'
              : `text-2xl ${theme.value} tabular-nums`
          }`}
        >
          {displayValue}
        </p>
      </div>
    </div>
  );
}
