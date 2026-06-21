import React, { useState, useCallback, useRef } from 'react';
import api from '../lib/api';
import {
  UploadCloud, CheckCircle, AlertTriangle, FileText, X,
  TableProperties, FileSpreadsheet, ArrowRight, Database
} from 'lucide-react';

const ACCEPTED = ['.csv', '.xlsx', '.xls'];
const API_BASE = import.meta.env.VITE_API_URL || '';

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [insertedCount, setInsertedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [recordCount, setRecordCount] = useState(null);
  const eventSourceRef = useRef(null);

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    const ext = f.name.toLowerCase();
    if (!ACCEPTED.some(a => ext.endsWith(a))) {
      return `Invalid file type. Please upload ${ACCEPTED.join(', ')} files only.`;
    }
    return null;
  };

  const selectFile = (f) => {
    const err = validateFile(f);
    if (err) {
      setStatus('error');
      setMessage(err);
      return;
    }
    setFile(f);
    setStatus('idle');
    setMessage('');
    setProgress(0);
    setInsertedCount(0);
    setTotalCount(0);
    setRecordCount(null);
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) selectFile(e.target.files[0]);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);

  const handleUpload = async () => {
    if (!file || status === 'uploading') return;
    setStatus('uploading');
    setProgress(0);
    setInsertedCount(0);
    setTotalCount(0);
    setProgressLabel('Preparing upload…');
    setMessage('');
    setRecordCount(null);

    const sessionId = generateSessionId();

    // Open SSE connection for real-time DB progress
    const sseUrl = `${API_BASE}/api/upload/progress/${sessionId}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'waiting') {
          setProgress(0);
          setProgressLabel('Preparing…');
        } else if (data.status === 'uploading') {
          setProgress(data.progress || 0);
          setInsertedCount(data.inserted || 0);
          setTotalCount(data.total || 0);
          if (data.total > 0) {
            setProgressLabel(`Inserting records into database… ${(data.inserted || 0).toLocaleString()} / ${(data.total || 0).toLocaleString()}`);
          } else {
            setProgressLabel('Processing file…');
          }
        } else if (data.status === 'done') {
          setProgress(100);
          setProgressLabel('Finalizing…');
          es.close();
        } else if (data.status === 'error') {
          es.close();
        }
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
    };

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/api/upload?sessionId=${sessionId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 min timeout for large files
        onUploadProgress: (evt) => {
          if (evt.total) {
            // While file is being sent over network, show "Transferring…" with partial %
            const networkPct = Math.round((evt.loaded * 100) / evt.total);
            if (networkPct < 100) {
              setProgress(networkPct > progress ? networkPct : progress);
              setProgressLabel(`Transferring file… ${networkPct}%`);
            }
          }
        },
      });

      es.close();
      eventSourceRef.current = null;

      const count = res.data.count || 0;
      setRecordCount(count);
      setStatus('success');
      setProgress(100);
      setMessage(`Successfully imported ${count.toLocaleString()} records.`);
      setFile(null);

      if (onUploadSuccess) {
        setTimeout(() => onUploadSuccess(), 1800);
      }
    } catch (err) {
      es.close();
      eventSourceRef.current = null;
      setStatus('error');
      const serverError = err.response?.data?.error || err.message;
      setMessage(`Upload failed: ${serverError}`);
      setProgress(0);
    }
  };

  const clearFile = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setFile(null);
    setStatus('idle');
    setMessage('');
    setProgress(0);
    setInsertedCount(0);
    setTotalCount(0);
    setRecordCount(null);
  };

  const isExcel = file?.name?.toLowerCase().match(/\.xlsx?$/);

  // Progress bar color based on progress
  const barColor = progress < 40
    ? 'from-blue-600 to-blue-400'
    : progress < 80
    ? 'from-blue-500 to-emerald-400'
    : 'from-emerald-600 to-emerald-400';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <UploadCloud className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Upload Dataset</h1>
          <p className="text-sm text-slate-400 mt-0.5">Import a CSV or Excel file containing parking violation records</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Drop Zone */}
        <div
          className={`glass-panel p-10 flex flex-col items-center justify-center border-2 border-dashed transition-all cursor-pointer relative rounded-2xl ${
            dragActive
              ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
              : file
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-slate-600 hover:border-blue-500/60 hover:bg-slate-800/30'
          } ${status === 'uploading' ? 'pointer-events-none opacity-70' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload-input"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            disabled={status === 'uploading'}
          />

          {!file ? (
            <>
              <div className="flex items-center gap-6 mb-5">
                <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                  <TableProperties className="w-8 h-8 text-blue-400" />
                </div>
                <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-1 text-white">
                {dragActive ? 'Drop your file here' : 'Drag & Drop your dataset here'}
              </h3>
              <p className="text-slate-400 text-sm">or click anywhere in this box to browse</p>
              <p className="text-slate-500 text-xs mt-2">Supports CSV, XLSX, XLS</p>
            </>
          ) : (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 px-5 py-3 rounded-xl">
              {isExcel
                ? <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                : <TableProperties className="w-5 h-5 text-blue-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{file.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB · {isExcel ? 'Excel Spreadsheet' : 'CSV File'}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="ml-1 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {status === 'uploading' && (
          <div className="glass-panel p-4 rounded-xl">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2.5">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                {progressLabel || 'Processing…'}
              </span>
              <span className="font-mono font-bold text-white tabular-nums">{progress}%</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full bg-gradient-to-r ${barColor} transition-all duration-500 ease-out relative overflow-hidden`}
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
            {totalCount > 0 && (
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{insertedCount.toLocaleString()} records inserted</span>
                <span>{totalCount.toLocaleString()} total</span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          {file && status !== 'uploading' && (
            <button
              onClick={clearFile}
              className="text-slate-400 hover:text-white text-sm border border-slate-700 hover:border-slate-600 px-5 py-2.5 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
          <button
            id="process-dataset-btn"
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {status === 'uploading' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Process Dataset
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {status === 'success' && (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-300">{message}</p>
              <p className="text-xs text-emerald-500/70 mt-1">
                Dashboard, heatmap, and analytics are being refreshed…
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                Redirecting to Command Center
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-400 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
