import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBanner } from './SkeletonCard';

function HeatmapLayer({ hotspots }) {
  return (
    <>
      {hotspots.map((hs, idx) => {
        let color = '#10b981'; // Green = low
        if (hs.risk_level === 'Moderate') color = '#f59e0b';
        if (hs.risk_level === 'High' || hs.risk_level === 'Critical') color = '#ef4444';
        const radius = Math.min(Math.max(hs.count * 1.5, 8), 50);

        return (
          <CircleMarker
            key={idx}
            center={[hs.lat, hs.lng]}
            radius={radius}
            pathOptions={{ fillColor: color, color: color, fillOpacity: 0.5, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="text-slate-800 p-1">
                <div className="font-bold text-sm border-b pb-1 mb-1 border-slate-300">{hs.area}</div>
                <strong>Risk Level:</strong> {hs.risk_level}<br />
                <strong>Risk Score:</strong> {hs.risk_score}<br />
                <strong>Violations:</strong> {hs.count?.toLocaleString()}
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
  const [error, setError] = useState(null);
  const center = [12.9716, 77.5946]; // Default: Bengaluru

  const fetchHotspots = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }

    api.get(`/api/hotspots?${params.toString()}`)
      .then(res => {
        setHotspots(res.data.hotspots || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message || 'Failed to load hotspot data.');
        setLoading(false);
      });
  }, [filters, uploadKey]);

  useEffect(() => {
    fetchHotspots();
  }, [fetchHotspots]);

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-56px)] md:h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">Live AI Hotspot Heatmap</h1>
        {!loading && (
          <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {hotspots.length} hotspot{hotspots.length !== 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={fetchHotspots} /></div>}

      <div className="flex-1 glass-panel p-2 relative min-h-[300px]">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-slate-900/70 rounded-xl backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-300 font-medium">Fetching hotspot data…</p>
          </div>
        )}

        <MapContainer center={center} zoom={12} className="w-full h-full rounded-lg z-0">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
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
