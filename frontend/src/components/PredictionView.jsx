import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  useEffect(() => {
    if (policeStations.length > 0 && (!params.location || !policeStations.includes(params.location))) {
      setParams(p => ({ ...p, location: policeStations[0] }));
    }
    if (vehicleTypes.length > 0 && (!params.vehicleType || !vehicleTypes.includes(params.vehicleType))) {
      setParams(p => ({ ...p, vehicleType: vehicleTypes[0] }));
    }
  }, [policeStations, vehicleTypes]);
  
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/predict', params);
      setPrediction(res.data);
    } catch(err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'AI service is currently initializing or training the model. Please try again in a few seconds.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    if (risk > 80) return 'text-red-500 border-red-500/30';
    if (risk > 50) return 'text-amber-500 border-amber-500/30';
    return 'text-emerald-500 border-emerald-500/30';
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Congestion Risk Prediction</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input parameters */}
        <div className="glass-panel p-6 lg:col-span-1 h-fit">
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
                  <option key={station} value={station} className="bg-slate-900 text-white">{station}</option>
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
                  <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
                ))}
              </select>
            </div>

            {/* Hour */}
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
                <span>12 AM</span>
                <span>12 PM</span>
                <span>11 PM</span>
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
                  <option key={day} value={idx} className="bg-slate-900 text-white">{day}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePredict}
              disabled={loading}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing with Random Forest...' : 'Predict Risk'}
            </button>
          </div>
        </div>

        {/* Right: Results display */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Random Forest Risk Assessment</h3>
            
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm mb-6 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!prediction && !error && !loading && (
              <div className="h-[250px] flex flex-col items-center justify-center text-slate-400">
                <Brain className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
                <p className="text-sm">Configure prediction parameters and click Predict.</p>
              </div>
            )}

            {loading && (
              <div className="h-[250px] flex flex-col items-center justify-center text-slate-400">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium">Training Random Forest model on historical dataset...</p>
                <p className="text-xs text-slate-500 mt-1">This might take a few seconds on first execution.</p>
              </div>
            )}

            {prediction && !loading && (
              <div className="space-y-8 my-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tomorrow Card */}
                  <div className="flex flex-col items-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-sm font-semibold mb-4">Tomorrow's Prediction</span>
                    <div className={`relative flex items-center justify-center w-36 h-36 rounded-full border-8 ${getRiskColor(prediction.tomorrow_risk)}`}>
                      <div className="text-center">
                        <span className="text-3xl font-extrabold text-white">{prediction.tomorrow_risk}%</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">Risk Index</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-4 text-center max-w-[200px]">
                      Expected traffic pressure at this location tomorrow during this time hour window.
                    </span>
                  </div>

                  {/* Next Week Card */}
                  <div className="flex flex-col items-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-sm font-semibold mb-4">Next Week's Prediction</span>
                    <div className={`relative flex items-center justify-center w-36 h-36 rounded-full border-8 ${getRiskColor(prediction.next_week_risk)}`}>
                      <div className="text-center">
                        <span className="text-3xl font-extrabold text-white">{prediction.next_week_risk}%</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">Risk Index</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-4 text-center max-w-[200px]">
                      Projected congestion trend for this exact day of the week and hour slot next week.
                    </span>
                  </div>
                </div>

                {/* Forecast Graphs (24-Hour Forecast) */}
                <div className="glass-panel p-6 bg-slate-800/20 rounded-xl border border-slate-700/50">
                  <h4 className="text-sm font-bold text-white mb-4">24-Hour Forecast Graphs</h4>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={prediction.hourly_forecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                        <Line type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} name="Congestion Risk" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Risk Trends & Future Hotspots Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 7-Day Risk Trends Bar Chart */}
                  <div className="glass-panel p-6 bg-slate-800/20 rounded-xl border border-slate-700/50">
                    <h4 className="text-sm font-bold text-white mb-4">Weekly Risk Trends (Risk Trends)</h4>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={prediction.weekly_trend}>
                          <XAxis dataKey="day" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                          <Bar dataKey="risk" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Predicted Risk" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Future Hotspots list */}
                  <div className="glass-panel p-6 bg-slate-800/20 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-4">Future Hotspots</h4>
                      <div className="space-y-3">
                        {prediction.future_hotspots?.map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-1.5 p-2 bg-slate-900/40 rounded-lg border border-slate-700/30">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-300">{idx + 1}. {item.area}</span>
                              <span className={`font-bold ${item.risk > 80 ? 'text-red-400' : item.risk > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {item.risk}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${item.risk > 80 ? 'bg-red-500' : item.risk > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${item.risk}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700/30 text-xs text-slate-400 leading-relaxed mt-4">
            <strong>Model Specifications:</strong> This prediction engine utilizes a <strong>Random Forest Regressor</strong> model dynamically trained on historical parking violations. It extracts features including time, location, day of week, and vehicle type to predict congestion pressure, allowing parking marshals to optimize resources proactively.
          </div>
        </div>
      </div>
    </div>
  );
}
