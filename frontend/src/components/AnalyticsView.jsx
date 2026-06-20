import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Golden ratio to generate visually distinct colors infinitely
const getDistinctColor = (index) => {
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 80%, 55%)`;
};

export default function AnalyticsView({ filters }) {
    const [data, setData] = useState({ byArea: [], byVehicleType: [] });

    useEffect(() => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });
        }
        axios.get(`/api/analytics?${params.toString()}`)
            .then(res => setData(res.data))
            .catch(console.error);
    }, [filters]);

    const total = useMemo(
        () => data.byVehicleType.reduce((sum, item) => sum + (item.value || 0), 0),
        [data.byVehicleType]
    );

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h1>
            
            <div className="flex flex-col gap-6">
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Violations by Area</h3>
                    <div className="w-full h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.byArea}>
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                                <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-1">Violations by Vehicle Type</h3>
                    <p className="text-sm text-slate-400 mb-4">Total: <span className="text-white font-semibold">{total.toLocaleString()}</span> violations</p>

                    {/* Donut Chart — no labels on slices */}
                    <div className="w-full h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.byVehicleType}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="50%"
                                    outerRadius="80%"
                                    paddingAngle={1}
                                    dataKey="value"
                                    stroke="#1e293b"
                                    strokeWidth={2}
                                    label={false}
                                    labelLine={false}
                                >
                                    {data.byVehicleType.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={getDistinctColor(index)}
                                            style={{ outline: 'none' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => {
                                        const percentage = ((value / Math.max(1, total)) * 100).toFixed(2);
                                        return [`${value.toLocaleString()} (${percentage}%)`, name];
                                    }}
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#fff', borderRadius: '10px', backdropFilter: 'blur(12px)', padding: '10px 14px' }}
                                    itemStyle={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: '13px' }}
                                    labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend — vehicle name, count and accurate % */}
                    <div className="mt-4 border-t border-slate-700/50 pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Vehicle Breakdown</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {data.byVehicleType.map((entry, idx) => {
                                const pct = ((entry.value / Math.max(1, total)) * 100).toFixed(2);
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-slate-800/60 hover:bg-slate-700/60 transition-colors border border-slate-700/40 rounded-lg px-3 py-2"
                                    >
                                        <span
                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: getDistinctColor(idx) }}
                                        />
                                        <span className="text-slate-300 text-xs font-medium truncate flex-1">{entry.name}</span>
                                        <div className="flex flex-col items-end ml-1 flex-shrink-0">
                                            <span className="text-white text-xs font-bold">{pct}%</span>
                                            <span className="text-slate-500 text-[10px]">{entry.value.toLocaleString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
