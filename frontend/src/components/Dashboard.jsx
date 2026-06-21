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
              icon={<Activity className="text-blue-500" />}
            />
            <StatCard
              title="Approved"
              value={stats.approvedViolations}
              icon={<CheckCircle className="text-emerald-500" />}
            />
            <StatCard
              title="Rejected"
              value={stats.rejectedViolations}
              icon={<XCircle className="text-red-500" />}
            />
            <StatCard
              title="Pending"
              value={stats.pendingViolations}
              icon={<Clock className="text-amber-400" />}
            />
            <StatCard
              title="Active Hotspots"
              value={stats.activeHotspots}
              icon={<MapPin className="text-amber-500" />}
            />
            <StatCard
              title="Highest Risk Area"
              value={stats.highestRiskArea ?? '—'}
              icon={<AlertTriangle className="text-red-500" />}
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
 * StatCard — displays a metric with no text truncation.
 * Large numbers are formatted; long strings (area names) wrap naturally.
 * isText = true means the value is a place name, not a number.
 */
function StatCard({ title, value, icon, isText = false }) {
  const displayValue = isText
    ? value
    : (value !== undefined && value !== null && value !== '' ? Number(value).toLocaleString() : '—');

  return (
    <div className="glass-panel p-4 flex justify-between items-start gap-3 min-w-0 w-full">
      <div className="min-w-0 flex-1">
        <p className="text-slate-400 text-xs mb-1 font-medium">{title}</p>
        <p
          className={`font-bold text-white leading-tight ${
            isText ? 'text-sm break-words' : 'text-xl sm:text-2xl tabular-nums whitespace-nowrap'
          }`}
        >
          {displayValue}
        </p>
      </div>
      <div className="p-2 bg-surface rounded-lg flex-shrink-0">
        {React.cloneElement(icon, { className: 'w-5 h-5 flex-shrink-0' })}
      </div>
    </div>
  );
}
