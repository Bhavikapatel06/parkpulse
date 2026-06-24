import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../lib/api';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBanner } from './SkeletonCard';
import { RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL = 30000; // 30 seconds

function MapAutoFit({ hotspots }) {
  const map = useMap();
  const prevHotspotsRef = useRef([]);

  useEffect(() => {
    if (hotspots.length > 0) {
      const prevAreas = prevHotspotsRef.current.map(h => h.area).join(',');
      const currAreas = hotspots.map(h => h.area).join(',');
      if (prevAreas !== currAreas) {
        const bounds = hotspots.map(hs => [hs.lat, hs.lng]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        prevHotspotsRef.current = hotspots;
      }
    }
  }, [hotspots, map]);

  return null;
}

function HeatmapLayer({ hotspots }) {
  return (
    <>
      {hotspots.map((hs, idx) => {
        let color = '#10b981'; // Green = low
        const rl = (hs.risk_level || '').toLowerCase();
        if (rl === 'moderate') color = '#f59e0b';
        if (rl === 'high' || rl === 'critical') color = '#ef4444';
        const radius = Math.min(Math.max(hs.count * 0.0004 + 12, 12), 55);

        return (
          <CircleMarker
            key={`${hs.area}-${idx}`}
            center={[hs.lat, hs.lng]}
            radius={radius}
            pathOptions={{ fillColor: color, color: color, fillOpacity: 0.45, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 4 }}>{hs.area}</div>
                <div><strong>Risk Level:</strong> {hs.risk_level}</div>
                <div><strong>Risk Score:</strong> {hs.risk_score}</div>
                <div><strong>Violations:</strong> {hs.count?.toLocaleString()}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function HeatmapView({ filters, uploadKey }) {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const center = [12.9716, 77.5946]; // Default: Bengaluru

  const fetchHotspots = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }

    api.get(`/api/hotspots?${params.toString()}`)
      .then(res => {
        setHotspots(res.data.hotspots || []);
        setLastUpdated(new Date());
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message || 'Failed to load hotspot data.');
        setLoading(false);
        setRefreshing(false);
      });
  }, [filters, uploadKey]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchHotspots(false);
    const interval = setInterval(() => fetchHotspots(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHotspots]);

  const formatTime = (date) => date
    ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="p-4 md:p-6 flex flex-col" style={{ height: 'calc(100vh - 0px)', minHeight: 480 }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-white">Live AI Hotspot Heatmap</h1>
          {/* Live pulse indicator */}
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {hotspots.length} hotspot{hotspots.length !== 1 ? 's' : ''} detected
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Updated {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => fetchHotspots(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={() => fetchHotspots(false)} /></div>}

      <div className="flex-1 glass-panel p-2 relative" style={{ minHeight: 300 }}>
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-slate-900/70 rounded-xl backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-300 font-medium">Fetching hotspot data…</p>
          </div>
        )}

        {/* Refreshing overlay (subtle) */}
        {refreshing && !loading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-800/90 border border-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Refreshing live data…
          </div>
        )}

        <MapContainer center={center} zoom={12} className="w-full h-full rounded-lg z-0" style={{ minHeight: 280 }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapAutoFit hotspots={hotspots} />
          <HeatmapLayer hotspots={hotspots} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 glass-panel p-3 z-[400] text-xs">
          <h4 className="font-bold mb-2 text-white">Risk Level</h4>
          <div className="flex items-center mb-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block mr-2 flex-shrink-0" />Low</div>
          <div className="flex items-center mb-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block mr-2 flex-shrink-0" />Moderate</div>
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 inline-block mr-2 flex-shrink-0" />High / Critical</div>
        </div>

        {/* Empty state */}
        {!loading && hotspots.length === 0 && !error && (
          <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center pointer-events-none">
            <div className="glass-panel p-6 text-center max-w-xs mx-auto">
              <p className="text-slate-400 text-sm">No hotspots detected for the current filters.</p>
              <p className="text-slate-500 text-xs mt-1">Try adjusting or clearing your filters.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
