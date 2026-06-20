import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function HeatmapLayer({ hotspots }) {
    return (
        <>
            {hotspots.map((hs, idx) => {
                let color = '#10b981'; // Green
                if (hs.risk_level === 'Moderate') color = '#f59e0b'; // Yellow
                if (hs.risk_level === 'High' || hs.risk_level === 'Critical') color = '#ef4444'; // Red

                // Cap the radius so a massive cluster doesn't cover the whole screen!
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
                                <strong>Risk Level:</strong> {hs.risk_level}<br/>
                                <strong>Risk Score:</strong> {hs.risk_score}<br/>
                                <strong>Violations:</strong> {hs.count}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </>
    );
}

export default function HeatmapView({ filters }) {
    const [hotspots, setHotspots] = useState([]);
    // Default to Bengaluru coordinates
    const center = [12.9716, 77.5946];

    useEffect(() => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });
        }
        axios.get(`/api/hotspots?${params.toString()}`)
            .then(res => setHotspots(res.data.hotspots || []))
            .catch(console.error);
    }, [filters]);

    return (
        <div className="p-6 h-[calc(100vh-80px)] flex flex-col">
            <h1 className="text-2xl font-bold text-white mb-6">Live AI Hotspot Heatmap</h1>
            <div className="flex-1 glass-panel p-2 relative">
                <MapContainer center={center} zoom={12} className="w-full h-full rounded-lg z-0">
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <HeatmapLayer hotspots={hotspots} />
                </MapContainer>
                
                {/* Legend Overlay */}
                <div className="absolute bottom-6 right-6 glass-panel p-4 z-[400] text-sm">
                    <h4 className="font-bold mb-2">Density</h4>
                    <div className="flex items-center mb-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block mr-2"></span> Low</div>
                    <div className="flex items-center mb-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block mr-2"></span> Medium</div>
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 inline-block mr-2"></span> High</div>
                </div>
            </div>
        </div>
    );
}
