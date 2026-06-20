import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Database, Trash2, Activity, Clock, Lock, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

export default function AdminPanel({ onDataCleared }) {
  const [logs, setLogs] = useState([]);
  const [recHistory, setRecHistory] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchAdminData = async () => {
    try {
      const [logsRes, historyRes] = await Promise.all([
        axios.get('/api/admin/logs'),
        axios.get('/api/admin/recommendation-history')
      ]);
      setLogs(logsRes.data);
      setRecHistory(historyRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  const executeDeleteDataset = async () => {
    setIsDeleting(true);
    try {
      await axios.delete('/api/admin/dataset');
      if (onDataCleared) onDataCleared();
      fetchAdminData();
      setShowModal(false);
    } catch (err) {
      alert("Failed to delete dataset: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Pending' ? 'Executed' : 'Pending';
    try {
      // Optimistic update
      setRecHistory(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      await axios.put(`/api/admin/recommendation-history/${id}/status`, { status: newStatus });
      fetchAdminData(); // Refresh logs
    } catch (err) {
      console.error(err);
      // Revert on failure
      fetchAdminData();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end mb-6 border-b border-slate-700/50 pb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
            <p className="text-slate-400 text-sm">System management and audit logs</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          SYSTEM ONLINE
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Dataset Management (Top Rectangle) */}
        <div className="glass-panel p-6 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <Database className="w-5 h-5" />
              <h3 className="font-bold text-lg">Dataset Management</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              <strong className="text-red-400">Warning:</strong> Managing the primary database affects all live dashboards, AI prediction models, and system logs. Wiping the database is an irreversible action.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-auto shrink-0 bg-red-500 hover:bg-red-600 text-white border border-red-500/50 font-bold py-3 px-6 rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Trash2 className="w-5 h-5" /> Wipe Entire Database
          </button>
        </div>

        {/* Bottom Section: History & Logs */}
        <div className="grid grid-cols-1 gap-6">
          {/* Recommendation History */}
          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-700/50 pb-2 text-white">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold">Recommendation Execution History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">ID</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Action Recommended</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-tr-lg">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-slate-500">No history available</td>
                  </tr>
                ) : (
                  recHistory.map((rec, i) => (
                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-400">{rec.id}</td>
                      <td className="px-4 py-3 font-semibold text-white">{rec.location}</td>
                      <td className="px-4 py-3 text-slate-300">{rec.action}</td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => toggleStatus(rec.id, rec.status)}
                          title="Click to toggle status"
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:scale-105 active:scale-95 ${rec.status === 'Executed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'}`}
                        >
                          {rec.status}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(rec.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

          {/* System Logs */}
          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-700/50 pb-2 text-white">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold">Live System Audit Logs</h3>
          </div>
          <div className="bg-slate-950/80 rounded-lg p-4 font-mono text-xs h-[300px] overflow-y-auto border border-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Awaiting system events...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-2 flex items-start gap-3">
                  <span className="text-slate-500 shrink-0">[{new Date(log.timestamp).toISOString()}]</span>
                  <span className={`shrink-0 font-bold ${log.level === 'WARN' ? 'text-amber-500' : log.level === 'ERROR' ? 'text-red-500' : 'text-blue-500'}`}>
                    {log.level}
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Premium Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !isDeleting && setShowModal(false)}></div>
          
          <div className="relative bg-slate-900 border border-slate-700/50 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_-12px_rgba(239,68,68,0.25)] overflow-hidden transform transition-all scale-100 opacity-100">
            {/* Glowing Top Border */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600"></div>
            
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/20 rounded-full blur-[60px] pointer-events-none"></div>
            
            <div className="relative z-10">
              {/* Pulsing Icon */}
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 text-red-500 relative">
                <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping opacity-75"></div>
                <AlertTriangle className="w-10 h-10 relative z-10" />
              </div>
              
              <h2 className="text-2xl font-extrabold text-white text-center mb-3 tracking-tight">Wipe Database?</h2>
              
              <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
                You are about to <strong className="text-red-400 font-bold">permanently destroy</strong> all violation data. This action cannot be undone and will instantly reset the AI training parameters.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={executeDeleteDataset}
                  disabled={isDeleting}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_-5px_rgba(239,68,68,0.6)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isDeleting ? 'Wiping Data...' : 'Yes, Destroy Everything'}
                </button>
                <button 
                  onClick={() => setShowModal(false)}
                  disabled={isDeleting}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 transition-all disabled:opacity-50"
                >
                  Cancel & Keep Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
