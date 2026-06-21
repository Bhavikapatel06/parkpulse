import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Brain, MapPin, Car, Clock, Calendar, ShieldAlert } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PredictionView({ metadata }) {
  const policeStations = metadata?.policeStations || [];
  const vehicleTypes = metadata?.vehicleTypes || [];

  const [params, setParams] = useState({
    location: '',
    vehicleType: '',
    hour: 12,
    dayOfWeek: 1
  });

  const [hasPredictedOnLoad, setHasPredictedOnLoad] = useState(false);

  useEffect(() => {
    if (policeStations.length > 0 && (!params.location || !policeStations.includes(params.location))) {
      setParams(p => ({ ...p, location: policeStations[0] }));
    }
    if (vehicleTypes.length > 0 && (!params.vehicleType || !vehicleTypes.includes(params.vehicleType))) {
      setParams(p => ({ ...p, vehicleType: vehicleTypes[0] }));
    }
  }, [policeStations, vehicleTypes, params.location, params.vehicleType]);

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async (activeParams = params) => {
    if (!activeParams.location || !activeParams.vehicleType) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/predict', activeParams, { timeout: 90000 });
      setPrediction(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'AI service is currently initializing or cold-starting. Please try again in a few seconds.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Automatic prediction on load is disabled so the user must click "Predict Risk"

  const getRiskColor = (risk) => {
    if (risk > 80) return 'text-red-500 border-red-500/30';
    if (risk > 50) return 'text-amber-500 border-amber-500/30';
    return 'text-emerald-500 border-emerald-500/30';
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-7 h-7 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
        <h1 className="text-xl md:text-2xl font-bold text-white">Congestion Risk Prediction</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameters Panel */}
        <div className="glass-panel p-5 lg:col-span-1 h-fit">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Prediction Parameters</h3>
          <div className="flex flex-col gap-4">
            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Target Location
              </label>
              <select
                value={params.location}
                onChange={(e) => setParams({ ...params, location: e.target.value })}
                className="bg-surface text-sm text-white p-2.5 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {policeStations.map(station => (
                  <option key={station} value={station} className="bg-slate-900">{station}</option>
                ))}
              </select>
            </div>

            {/* Vehicle Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Car className="w-3.5 h-3.5" /> Vehicle Type
              </label>
              <select
                value={params.vehicleType}
                onChange={(e) => setParams({ ...params, vehicleType: e.target.value })}
                className="bg-surface text-sm text-white p-2.5 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {vehicleTypes.map(type => (
                  <option key={type} value={type} className="bg-slate-900">{type}</option>
                ))}
              </select>
            </div>

            {/* Hour Slider */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Target Hour ({params.hour}:00)
              </label>
              <input
                type="range"
                min="0"
                max="23"
                value={params.hour}
                onChange={(e) => setParams({ ...params, hour: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>12 AM</span><span>12 PM</span><span>11 PM</span>
              </div>
            </div>

            {/* Day of Week */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Day of Week
              </label>
              <select
                value={params.dayOfWeek}
                onChange={(e) => setParams({ ...params, dayOfWeek: parseInt(e.target.value) })}
                className="bg-surface text-sm text-white p-2.5 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {DAYS.map((day, idx) => (
                  <option key={day} value={idx} className="bg-slate-900">{day}</option>
                ))}
              </select>
            </div>

            <button
              id="predict-risk-btn"
              onClick={() => handlePredict(params)}
              disabled={loading || !params.location}
              className="mt-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-blue-500/20 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : 'Predict Risk'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="glass-panel p-5 lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">
            Random Forest Risk Assessment
          </h3>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm mb-6 flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!prediction && !error && !loading && (
            <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center text-slate-400">
              <Brain className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
              <p className="text-sm text-center">Configure parameters and click <strong>Predict Risk</strong>.</p>
              <p className="text-xs text-slate-500 mt-1">Uses a Random Forest model trained on your uploaded data.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Analyzing Data & Running Predictions…</p>
                <p className="text-xs text-slate-400 mt-1.5">
                  Training a custom Random Forest Regressor on the active dataset.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  (Note: If the AI service is starting up, this might take up to 60s. Subsequent requests are instantaneous)
                </p>
              </div>
            </div>
          )}

          {prediction && !loading && (
            <div className="space-y-6 mt-2">
              {/* Risk circles */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Tomorrow's Prediction", risk: prediction.tomorrow_risk },
                  { label: "Next Week's Prediction", risk: prediction.next_week_risk }
                ].map(({ label, risk }) => (
                  <div key={label} className="flex flex-col items-center p-5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-xs font-semibold mb-4 text-center">{label}</span>
                    <div className={`flex items-center justify-center w-28 h-28 md:w-32 md:h-32 rounded-full border-8 ${getRiskColor(risk)}`}>
                      <div className="text-center">
                        <span className="text-2xl md:text-3xl font-extrabold text-white">{risk}%</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">Risk Index</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 24-Hour Forecast */}
              <div className="glass-panel p-4 bg-slate-800/20 rounded-xl border border-slate-700/50">
                <h4 className="text-sm font-bold text-white mb-4">24-Hour Forecast</h4>
                <div className="h-[180px] md:h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prediction.hourly_forecast}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                      <Line type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Congestion Risk" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly Trend + Future Hotspots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 bg-slate-800/20 rounded-xl border border-slate-700/50">
                  <h4 className="text-sm font-bold text-white mb-4">Weekly Risk Trend</h4>
                  <div className="h-[160px] md:h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prediction.weekly_trend}>
                        <XAxis dataKey="day" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                        <Bar dataKey="risk" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Predicted Risk" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel p-4 bg-slate-800/20 rounded-xl border border-slate-700/50">
                  <h4 className="text-sm font-bold text-white mb-4">Future Hotspots</h4>
                  <div className="space-y-2.5">
                    {prediction.future_hotspots?.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1 p-2 bg-slate-900/40 rounded-lg border border-slate-700/30">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300 truncate flex-1">{idx + 1}. {item.area}</span>
                          <span className={`font-bold ml-2 flex-shrink-0 ${item.risk > 80 ? 'text-red-400' : item.risk > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {item.risk}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${item.risk > 80 ? 'bg-red-500' : item.risk > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${item.risk}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700/30 text-xs text-slate-400 leading-relaxed mt-4">
            <strong>Model:</strong> Random Forest Regressor trained on historical parking violations using time, location, day-of-week, and vehicle-type features.
          </div>
        </div>
      </div>
    </div>
  );
}
