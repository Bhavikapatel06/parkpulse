import React, { useState, useCallback, useRef, useEffect } from 'react';
import api from '../lib/api';
import { io } from 'socket.io-client';
import {
  UploadCloud, CheckCircle, AlertTriangle, FileText, X,
  TableProperties, FileSpreadsheet, ArrowRight, Database, Search, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';

const ACCEPTED = ['.csv', '.xlsx', '.xls'];

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
  
  // Data view state
  const [viewMode, setViewMode] = useState('loading'); // loading | upload | data
  const [dataRecords, setDataRecords] = useState([]);
  const [dbTotalRecords, setDbTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const socketRef = useRef(null);

  const fetchViolations = async (currentPage = 1, currentSearch = '') => {
    try {
      const res = await api.get(`/api/violations?page=${currentPage}&limit=10&search=${currentSearch}`);
      const { records, totalRecords, totalPages } = res.data;
      setDbTotalRecords(totalRecords);
      setDataRecords(records);
      setTotalPages(totalPages);
      setPage(currentPage);
      
      if (totalRecords > 0) {
        setViewMode('data');
      } else {
        setViewMode('upload');
      }
    } catch (err) {
      console.error('Failed to fetch records', err);
      setViewMode('upload');
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchViolations(page, search);

    // Setup Socket.IO
    // Socket.IO must connect DIRECTLY to the backend (not through Vercel proxy)
    // because Vercel's edge network cannot proxy WebSocket connections.
    // VITE_API_URL should always point to the Render backend: https://parkipluse-1.onrender.com
    const socketURL = import.meta.env.VITE_API_URL || api.defaults.baseURL || 'http://localhost:3000';
    socketRef.current = io(socketURL, { transports: ['websocket', 'polling'] });

    socketRef.current.on('data_updated', () => {
      fetchViolations(1, search);
      if (onUploadSuccess) onUploadSuccess();
    });

    socketRef.current.on('data_deleted', () => {
      setDbTotalRecords(0);
      setDataRecords([]);
      setViewMode('upload');
      if (onUploadSuccess) onUploadSuccess();
    });

    socketRef.current.on('upload_progress', (data) => {
      // If someone else is uploading or we are uploading
      setViewMode('upload');
      setStatus('uploading');
      setProgress(Math.floor((data.inserted / (data.total || 1)) * 100));
      setInsertedCount(data.inserted);
      setTotalCount(data.total);
      setProgressLabel(`Inserting records... ${data.inserted.toLocaleString()} / ${data.total.toLocaleString()}`);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    fetchViolations(1, e.target.value);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchViolations(newPage, search);
    }
  };

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
    setProgressLabel('Uploading file to server…');
    setMessage('');
    setRecordCount(null);

    const sessionId = generateSessionId();

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/upload?sessionId=${sessionId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
        onUploadProgress: (evt) => {
          if (evt.total) {
            const networkPct = Math.round((evt.loaded * 100) / evt.total);
            if (networkPct < 100) {
              setProgress(Math.floor(networkPct * 0.2)); // map file transfer to 0-20% progress
              setProgressLabel(`Transferring file… ${networkPct}%`);
            }
          }
        },
      });
      // Progress is now handled by Socket.IO
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
    setInsertedCount(0);
    setTotalCount(0);
    setRecordCount(null);
  };

  const isExcel = file?.name?.toLowerCase().match(/\.xlsx?$/);

  const barColor = progress < 40
    ? 'from-blue-600 to-blue-400'
    : progress < 80
    ? 'from-blue-500 to-emerald-400'
    : 'from-emerald-600 to-emerald-400';

  if (viewMode === 'loading') {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-3 text-blue-400">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading data state...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'data') {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="glass-panel p-6 mb-6 bg-emerald-500/10 border-emerald-500/30 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-emerald-400">Data already exists. No need to upload again.</h2>
            <p className="text-sm text-emerald-500/80">Total Records: {dbTotalRecords.toLocaleString()}</p>
          </div>
          <div className="ml-auto">
             <button
               onClick={() => setViewMode('upload')}
               className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm font-semibold transition-colors"
             >
               Force New Upload
             </button>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Live Dataset View
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search station, vehicle..."
                value={search}
                onChange={handleSearchChange}
                className="bg-slate-800/50 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-slate-300 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Violation</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {dataRecords.length > 0 ? dataRecords.map(record => (
                  <tr key={record._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {new Date(record.created_datetime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {record.police_station || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {record.vehicle_type || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {record.violation_type || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        record.validation_status?.toLowerCase() === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        record.validation_status?.toLowerCase() === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {record.validation_status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                      No records found matching "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-slate-400">
                Page <span className="font-semibold text-white">{page}</span> of <span className="font-semibold text-white">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-slate-700 text-slate-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-slate-700 text-slate-300 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Existing Upload UI structure, wrapped nicely */}
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

        {status === 'success' && (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-300">{message}</p>
              <p className="text-xs text-emerald-500/70 mt-1">
                Dashboard, heatmap, and analytics are being refreshed…
              </p>
            </div>
          </div>
        )}

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
