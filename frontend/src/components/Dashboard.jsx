import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, MapPin, Activity, CheckCircle, XCircle } from 'lucide-react';

export default function Dashboard({ filters }) {
    const [stats, setStats] = useState({
        totalViolations: 0,
        approvedViolations: 0,
        rejectedViolations: 0,
        activeHotspots: 0,
        highestRiskArea: 'Loading...'
    });
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });
        }
        const queryString = params.toString();
        axios.get(`/api/dashboard?${queryString}`).then(res => setStats(res.data)).catch(console.error);
        axios.get(`/api/recommendations?${queryString}`).then(res => setRecommendations(res.data)).catch(console.error);
    }, [filters]);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Command Center Overview</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <StatCard title="Total Violations" value={stats.totalViolations} icon={<Activity className="text-blue-500" />} />
                <StatCard title="Approved" value={stats.approvedViolations} icon={<CheckCircle className="text-emerald-500" />} />
                <StatCard title="Rejected" value={stats.rejectedViolations} icon={<XCircle className="text-red-500" />} />
                <StatCard title="Active Hotspots" value={stats.activeHotspots} icon={<MapPin className="text-amber-500" />} />
                <StatCard title="Highest Risk Area" value={stats.highestRiskArea} icon={<AlertTriangle className="text-red-500" />} />
            </div>

            <h2 className="text-xl font-bold text-white mb-4">Actionable Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec, idx) => (
                    <div key={idx} className="glass-panel p-6 border-l-4 border-l-blue-500 hover:scale-[1.02] transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-white">{rec.location}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${rec.risk > 80 ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                Risk: {rec.risk}
                            </span>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">{rec.recommendation}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }) {
    return (
        <div className="glass-panel p-5 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-sm mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
            </div>
            <div className="p-3 bg-surface rounded-lg">
                {icon}
            </div>
        </div>
    );
}
