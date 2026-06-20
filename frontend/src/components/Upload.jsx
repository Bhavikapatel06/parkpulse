import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';

export default function Upload({ onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        if(e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if(!file) return;
        setStatus('uploading');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus('success');
            setMessage(`Successfully uploaded ${res.data.count} records.`);
            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch(err) {
            setStatus('error');
            const serverError = err.response?.data?.error || err.message;
            setMessage(`Error uploading file: ${serverError}`);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Upload Dataset</h1>
            <div className="glass-panel p-8 flex flex-col items-center justify-center border-dashed border-2 border-slate-600 hover:border-blue-500 transition-colors cursor-pointer relative"
                 onDragOver={e => e.preventDefault()}
                 onDrop={e => { e.preventDefault(); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
            >
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".csv, .xlsx, .xls, text/csv, application/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
                <UploadCloud className="w-16 h-16 text-slate-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Drag & Drop CSV</h3>
                <p className="text-slate-400 mb-4">or click to browse files</p>
                {file && <div className="bg-surface px-4 py-2 rounded text-sm text-blue-500">{file.name}</div>}
            </div>

            <div className="mt-6 flex justify-end">
                <button 
                    onClick={handleUpload} 
                    disabled={!file || status === 'uploading'}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                    {status === 'uploading' ? 'Uploading...' : 'Process Dataset'}
                </button>
            </div>

            {status === 'success' && (
                <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500 text-emerald-500 rounded-lg flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {message}
                </div>
            )}
            {status === 'error' && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500 text-red-500 rounded-lg flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    {message}
                </div>
            )}
        </div>
    );
}
