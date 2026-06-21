import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, BarChart2, UploadCloud, ShieldAlert, Brain, Sparkles, FileText, ShieldCheck, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Sidebar supports:
 * - Desktop (md+): fixed, always visible
 * - Mobile (<md): slide-in drawer, controlled by isOpen/onClose props
 */
export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={cn(
          // Base styles
          'w-64 bg-surface border-r border-slate-700/50 flex flex-col h-screen',
          // Desktop: always fixed on left
          'md:fixed md:left-0 md:top-0 md:translate-x-0',
          // Mobile: fixed overlay, slides in/out
          'fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-blue-500 flex-shrink-0" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent">
              ParkPulse AI
            </h1>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" onClick={onClose} />
          <NavItem to="/heatmap" icon={<Map />} label="Live Heatmap" onClick={onClose} />
          <NavItem to="/analytics" icon={<BarChart2 />} label="Analytics" onClick={onClose} />
          <NavItem to="/prediction" icon={<Brain />} label="Prediction" onClick={onClose} />
          <NavItem to="/simulation" icon={<Sparkles />} label="Event Simulator" onClick={onClose} />
          <NavItem to="/reports" icon={<FileText />} label="Reports Center" onClick={onClose} />
          <NavItem to="/upload" icon={<UploadCloud />} label="Data Upload" onClick={onClose} />
          <div className="pt-2 pb-1">
            <div className="border-t border-slate-700/50 w-full" />
          </div>
          <NavItem to="/admin" icon={<ShieldCheck />} label="Admin Panel" onClick={onClose} />
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 text-xs text-slate-500 text-center">
          ParkPulse AI &copy; 2026
        </div>
      </aside>
    </>
  );
}

function NavItem({ to, icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium',
        isActive
          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      )}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5 flex-shrink-0' })}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
