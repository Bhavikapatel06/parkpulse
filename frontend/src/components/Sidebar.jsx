import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, BarChart2, UploadCloud, ShieldAlert, Brain, Sparkles, FileText, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
    return (
        <div className="w-64 bg-surface border-r border-slate-700/50 flex flex-col h-screen fixed left-0 top-0">
            <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
                <ShieldAlert className="w-8 h-8 text-blue-500" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent">ParkPulse AI</h1>
            </div>
            
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" />
                <NavItem to="/heatmap" icon={<Map />} label="Live Heatmap" />
                <NavItem to="/analytics" icon={<BarChart2 />} label="Analytics" />
                <NavItem to="/prediction" icon={<Brain />} label="Prediction" />
                <NavItem to="/simulation" icon={<Sparkles />} label="Event Simulator" />
                <NavItem to="/reports" icon={<FileText />} label="Reports Center" />
                <NavItem to="/upload" icon={<UploadCloud />} label="Data Upload" />
                <div className="pt-2 pb-1"><div className="border-t border-slate-700/50 w-full"></div></div>
                <NavItem to="/admin" icon={<ShieldCheck />} label="Admin Panel" />
            </nav>
            
            <div className="p-4 border-t border-slate-700/50 text-xs text-slate-500 text-center">
                ParkPulse AI &copy; 2026
            </div>
        </div>
    );
}

function NavItem({ to, icon, label }) {
    return (
        <NavLink 
            to={to} 
            className={({isActive}) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium",
                isActive 
                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
        >
            {React.cloneElement(icon, { className: "w-5 h-5" })}
            {label}
        </NavLink>
    );
}
