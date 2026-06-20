import React from 'react';
import { Calendar, Shield, Car, AlertTriangle, MapPin } from 'lucide-react';

const RISK_LEVELS = ['Low', 'Medium', 'High'];

export default function FilterPanel({ filters, onChange, onClear, metadata }) {
  const policeStations = metadata?.policeStations || [];
  const vehicleTypes = metadata?.vehicleTypes || [];
  const violationTypes = metadata?.violationTypes || [];

  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="glass-panel p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            title="Start Date"
            aria-label="Start Date"
            value={filters.startDate || ''} 
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            placeholder="Start Date"
          />
          <span className="text-slate-500 text-xs">to</span>
          <input 
            type="date" 
            title="End Date"
            aria-label="End Date"
            value={filters.endDate || ''} 
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            placeholder="End Date"
          />
        </div>

        {/* Police Station Filter */}
        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-slate-700">
          <MapPin className="w-4 h-4 text-slate-400" />
          <select 
            title="Police Station Filter"
            aria-label="Police Station Filter"
            value={filters.policeStation || ''} 
            onChange={(e) => handleChange('policeStation', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer pr-4"
          >
            <option value="" className="bg-slate-900 text-white">All Stations</option>
            {policeStations.map(station => (
              <option key={station} value={station} className="bg-slate-900 text-white">{station}</option>
            ))}
          </select>
        </div>

        {/* Vehicle Type Filter */}
        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-slate-700">
          <Car className="w-4 h-4 text-slate-400" />
          <select 
            title="Vehicle Type Filter"
            aria-label="Vehicle Type Filter"
            value={filters.vehicleType || ''} 
            onChange={(e) => handleChange('vehicleType', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer pr-4"
          >
            <option value="" className="bg-slate-900 text-white">All Vehicles</option>
            {vehicleTypes.map(type => (
              <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
            ))}
          </select>
        </div>

        {/* Violation Type Filter */}
        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-slate-700">
          <AlertTriangle className="w-4 h-4 text-slate-400" />
          <select 
            title="Violation Type Filter"
            aria-label="Violation Type Filter"
            value={filters.violationType || ''} 
            onChange={(e) => handleChange('violationType', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer pr-4 max-w-[200px]"
          >
            <option value="" className="bg-slate-900 text-white">All Violations</option>
            {violationTypes.map(type => (
              <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
            ))}
          </select>
        </div>

        {/* Risk Level / Validation Status Filter */}
        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-slate-700">
          <Shield className="w-4 h-4 text-slate-400" />
          <select 
            title="Risk Level Filter"
            aria-label="Risk Level Filter"
            value={filters.riskLevel || ''} 
            onChange={(e) => handleChange('riskLevel', e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer pr-4"
          >
            <option value="" className="bg-slate-900 text-white">All Risk Levels</option>
            {RISK_LEVELS.map(level => (
              <option key={level} value={level} className="bg-slate-900 text-white">{level} Risk</option>
            ))}
          </select>
        </div>
      </div>

      <button 
        onClick={onClear}
        className="text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700"
      >
        Clear Filters
      </button>
    </div>
  );
}
