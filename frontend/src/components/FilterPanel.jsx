import React from 'react';
import { Calendar, Shield, Car, AlertTriangle, MapPin, X } from 'lucide-react';

const RISK_LEVELS = ['Low', 'Medium', 'High'];

export default function FilterPanel({ filters, onChange, onClear, metadata }) {
  const policeStations = metadata?.policeStations || [];
  const vehicleTypes = metadata?.vehicleTypes || [];
  const violationTypes = metadata?.violationTypes || [];

  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="glass-panel p-3 md:p-4 mb-4 md:mb-6">
      <div className="flex flex-wrap gap-2 md:gap-3 items-center">

        {/* Date Range */}
        <div className="flex items-center gap-1.5 bg-surface p-2 rounded-lg border border-slate-700 min-w-0">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="date"
            title="Start Date"
            aria-label="Start Date"
            value={filters.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-28"
          />
          <span className="text-slate-500 text-xs">–</span>
          <input
            type="date"
            title="End Date"
            aria-label="End Date"
            value={filters.endDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-28"
          />
        </div>

        {/* Police Station */}
        <div className="flex items-center gap-1.5 bg-surface p-2 rounded-lg border border-slate-700">
          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            title="Police Station Filter"
            aria-label="Police Station Filter"
            value={filters.policeStation || ''}
            onChange={(e) => handleChange('policeStation', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[140px]"
          >
            <option value="" className="bg-slate-900">All Stations</option>
            {policeStations.map(station => (
              <option key={station} value={station} className="bg-slate-900">{station}</option>
            ))}
          </select>
        </div>

        {/* Vehicle Type */}
        <div className="flex items-center gap-1.5 bg-surface p-2 rounded-lg border border-slate-700">
          <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            title="Vehicle Type Filter"
            aria-label="Vehicle Type Filter"
            value={filters.vehicleType || ''}
            onChange={(e) => handleChange('vehicleType', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[120px]"
          >
            <option value="" className="bg-slate-900">All Vehicles</option>
            {vehicleTypes.map(type => (
              <option key={type} value={type} className="bg-slate-900">{type}</option>
            ))}
          </select>
        </div>

        {/* Violation Type */}
        <div className="flex items-center gap-1.5 bg-surface p-2 rounded-lg border border-slate-700">
          <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            title="Violation Type Filter"
            aria-label="Violation Type Filter"
            value={filters.violationType || ''}
            onChange={(e) => handleChange('violationType', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[150px]"
          >
            <option value="" className="bg-slate-900">All Violations</option>
            {violationTypes.map(type => (
              <option key={type} value={type} className="bg-slate-900">{type}</option>
            ))}
          </select>
        </div>

        {/* Risk Level */}
        <div className="flex items-center gap-1.5 bg-surface p-2 rounded-lg border border-slate-700">
          <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            title="Risk Level Filter"
            aria-label="Risk Level Filter"
            value={filters.riskLevel || ''}
            onChange={(e) => handleChange('riskLevel', e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[110px]"
          >
            <option value="" className="bg-slate-900">All Risk Levels</option>
            {RISK_LEVELS.map(level => (
              <option key={level} value={level} className="bg-slate-900">{level} Risk</option>
            ))}
          </select>
        </div>

        {/* Clear button — only shows when filters are active */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors border border-slate-700"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  );
}
