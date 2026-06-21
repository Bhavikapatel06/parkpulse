import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Play, Sparkles, Gauge, Info, Zap, Music, ShoppingBag, Train } from 'lucide-react';

const EVENTS = [
  { id: 'festival', name: 'Festival Celebration', icon: Sparkles, color: 'amber', pressure: 55, congestion: 45, officers: 10, description: 'Large cultural or religious gathering' },
  { id: 'concert', name: 'Major Music Concert', icon: Music, color: 'purple', pressure: 45, congestion: 35, officers: 8, description: 'High-footfall music event or stadium show' },
  { id: 'sale', name: 'Big Shopping Sale', icon: ShoppingBag, color: 'emerald', pressure: 35, congestion: 25, officers: 6, description: 'Commercial sale day driving retail traffic' },
  { id: 'metro', name: 'Metro Line Launch', icon: Train, color: 'blue', pressure: 25, congestion: 15, officers: 4, description: 'Public transit launch generating crowd surge' },
];

const colorMap = {
  amber:   { ring: 'border-amber-500',   text: 'text-amber-500',   bg: 'bg-amber-500/10',   badge: 'bg-amber-500' },
  purple:  { ring: 'border-purple-500',  text: 'text-purple-500',  bg: 'bg-purple-500/10',  badge: 'bg-purple-500' },
  emerald: { ring: 'border-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500' },
  blue:    { ring: 'border-blue-500',    text: 'text-blue-500',    bg: 'bg-blue-500/10',    badge: 'bg-blue-500' },
};

function RingMetric({ label, value, suffix = '%', prefix = '+', color, sub }) {
  return (
    <div className="flex flex-col items-center p-4 md:p-5 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600/70 transition-all">
      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 text-center">{label}</span>
      <div className={`relative flex items-center justify-center w-24 h-24 md:w-28 md:h-28 rounded-full border-[5px] ${color.ring}/40`}>
        <div className={`absolute inset-2 rounded-full ${color.bg} opacity-60`} />
        <span className={`relative text-xl md:text-2xl font-black ${color.text}`}>{prefix}{value}{suffix}</span>
      </div>
      <span className="text-[10px] text-slate-500 mt-3 text-center leading-relaxed max-w-[120px]">{sub}</span>
    </div>
  );
}

export default function SimulationView({ metadata }) {
  const policeStations = metadata?.policeStations || [];
  const [selectedEvent, setSelectedEvent] = useState('festival');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [results, setResults] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (policeStations.length > 0 && (!selectedLocation || !policeStations.includes(selectedLocation))) {
      setSelectedLocation(policeStations[0]);
    }
  }, [policeStations]);

  useEffect(() => {
    api.get('/api/analytics')
      .then(res => setAnalytics(res.data))
      .catch(console.error);
  }, []);

  const handleSimulate = () => {
    setSimulating(true);
    setResults(null);

    setTimeout(() => {
      const eventData = EVENTS.find(e => e.id === selectedEvent);
      let baselineScale = 1.0;

      if (analytics?.byArea) {
        const areaData = analytics.byArea.find(a => a.name === selectedLocation);
        const totalAreaCount = analytics.byArea.reduce((sum, item) => sum + item.value, 0);
        const avgAreaCount = totalAreaCount / Math.max(1, policeStations.length);
        if (areaData) baselineScale = areaData.value / Math.max(1, avgAreaCount);
      }

      const scale = Math.min(1.8, Math.max(0.5, baselineScale));
      setResults({
        parkingPressure:     Math.min(100, Math.floor(eventData.pressure * scale)),
        congestionIncrease:  Math.min(100, Math.floor(eventData.congestion * scale)),
        recommendedOfficers: Math.max(2, Math.floor(eventData.officers * scale)),
        eventColor: eventData.color,
        eventName:  eventData.name,
        location:   selectedLocation,
      });
      setSimulating(false);
    }, 1200);
  };

  const selectedEventObj = EVENTS.find(e => e.id === selectedEvent);
  const selectedColor = colorMap[selectedEventObj?.color] || colorMap.amber;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <Zap className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Event Impact Simulator</h1>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Model parking & traffic pressure for upcoming public events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="glass-panel p-5 lg:col-span-1 h-fit flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Event Type</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {EVENTS.map(event => {
                const Icon = event.icon;
                const c = colorMap[event.color];
                const active = selectedEvent === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => { setSelectedEvent(event.id); setResults(null); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      active
                        ? `${c.bg} ${c.ring} border text-white shadow-lg`
                        : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${active ? c.bg : 'bg-slate-700/50'}`}>
                      <Icon className={`w-4 h-4 ${active ? c.text : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{event.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{event.description}</p>
                    </div>
                    {active && <div className={`w-2 h-2 rounded-full ${c.badge} flex-shrink-0`} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Location</p>
            <select
              value={selectedLocation}
              onChange={(e) => { setSelectedLocation(e.target.value); setResults(null); }}
              className="w-full bg-slate-800/70 text-sm text-white p-2.5 rounded-xl border border-slate-700 focus:border-amber-500 focus:outline-none transition-all"
            >
              {policeStations.map(station => (
                <option key={station} value={station} className="bg-slate-900">{station}</option>
              ))}
            </select>
          </div>

          <button
            id="run-simulation-btn"
            onClick={handleSimulate}
            disabled={simulating || !selectedLocation}
            className={`w-full font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${selectedColor.bg} border ${selectedColor.ring}/50 ${selectedColor.text} hover:opacity-90`}
          >
            {simulating ? (
              <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Simulating…</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> Run Simulation</>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="glass-panel p-5 lg:col-span-2 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-700 pb-3">
            <h3 className="text-lg font-bold text-white">Impact Projections</h3>
            {results && (
              <span className="text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                {results.eventName} · {results.location}
              </span>
            )}
          </div>

          {!results && !simulating && (
            <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                <Gauge className="w-8 h-8 text-slate-600 animate-pulse" />
              </div>
              <p className="text-sm font-medium">Select an event type and location</p>
              <p className="text-xs text-slate-600">Then click Run Simulation to see projections</p>
            </div>
          )}

          {simulating && (
            <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Analyzing historical density data…</p>
                <p className="text-xs text-slate-500 mt-1">Applying location-weighted multipliers</p>
              </div>
            </div>
          )}

          {results && !simulating && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 flex-1">
                <RingMetric label="Parking Pressure Increase" value={results.parkingPressure} color={colorMap.amber} sub="Higher demand on street and public parking vs. baseline" />
                <RingMetric label="Traffic Congestion Increase" value={results.congestionIncrease} color={colorMap.purple} sub="Projected drop in average local vehicle speed" />
                <RingMetric label="Recommended Officers" value={results.recommendedOfficers} suffix="" prefix="" color={colorMap.blue} sub="Traffic marshals to deploy for overflow management" />
              </div>

              <div className={`mt-2 p-3 rounded-xl border ${selectedColor.bg} ${selectedColor.ring}/30 flex items-start gap-2`}>
                <Info className={`w-4 h-4 ${selectedColor.text} flex-shrink-0 mt-0.5`} />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">{results.location}</strong> has{' '}
                  {results.parkingPressure >= 50 ? 'high historical congestion, requiring elevated deployment.' : 'moderate baseline congestion — standard protocols should suffice.'}{' '}
                  Adjust patrol shifts at least <strong className="text-white">2 hours</strong> before event start.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
