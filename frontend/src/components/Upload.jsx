import React, { useState, useCallback } from 'react';
import api from '../lib/api';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, X } from 'lucide-react';

const ACCEPTED = ['.csv', '.xlsx', '.xls'];
const MAX_SIZE_MB = 100;

export default function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    const ext = f.name.toLowerCase();
    if (!ACCEPTED.some(a => ext.endsWith(a))) {
      return `Invalid file type. Please upload ${ACCEPTED.join(', ')} files only.`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
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
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 min timeout for large CSVs
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      });
      setStatus('success');
      setMessage(`Successfully uploaded ${res.data.count?.toLocaleString() || 0} records.`);
      setFile(null);
      setProgress(0);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setStatus('error');
      const serverError = err.response?.data?.error || err.message;
      setMessage(`Upload failed: ${serverError}`);
      setProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setStatus('idle');
    setMessage('');
    setProgress(0);
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Upload Dataset</h1>

      {/* Drop Zone */}
      <div
        className={`glass-panel p-8 flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer relative rounded-xl ${
          dragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-slate-600 hover:border-blue-500/60'
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

        <UploadCloud className={`w-14 h-14 mb-4 transition-colors ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
        <h3 className="text-lg font-semibold mb-1 text-white">
          {dragActive ? 'Drop file here' : 'Drag & Drop your dataset'}
        </h3>
        <p className="text-slate-400 text-sm mb-4">or click to browse — CSV, XLSX, XLS (max {MAX_SIZE_MB}MB)</p>

        {file && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-lg text-sm">
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-blue-300 font-medium truncate max-w-xs">{file.name}</span>
            <span className="text-slate-500 text-xs">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="ml-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {status === 'uploading' && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Uploading & processing records…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {progress < 100
              ? 'Transferring file to server…'
              : 'File received — inserting records into database…'}
          </p>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
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
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
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

      {/* Status Messages */}
      {status === 'success' && (
        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{message}</p>
            <p className="text-xs text-emerald-500/70 mt-0.5">Dashboard, heatmap, and analytics have been refreshed automatically.</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/40 text-red-400 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{message}</p>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 glass-panel p-4 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-300">Supported Columns:</strong> The system auto-detects column names —{' '}
        <code className="text-blue-400">latitude/lat</code>,{' '}
        <code className="text-blue-400">longitude/lng</code>,{' '}
        <code className="text-blue-400">police_station</code>,{' '}
        <code className="text-blue-400">vehicle_type</code>,{' '}
        <code className="text-blue-400">violation_type</code>,{' '}
        <code className="text-blue-400">created_datetime</code>,{' '}
        <code className="text-blue-400">validation_status</code>.{' '}
        Uploading a new file will replace the existing dataset.
      </div>
    </div>
  );
}
