import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import api from '../lib/api';
import { Download, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ReportGenerator({ filters }) {
  const [downloading, setDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dashboardStats, setDashboardStats] = useState({
    totalViolations: 0,
    approvedViolations: 0,
    rejectedViolations: 0,
    activeHotspots: 0,
    highestRiskArea: 'Loading...'
  });
  const [analyticsData, setAnalyticsData] = useState({ byArea: [], byVehicleType: [] });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.policeStation) params.append('policeStation', filters.policeStation);
    if (filters.vehicleType) params.append('vehicleType', filters.vehicleType);
    if (filters.violationType) params.append('violationType', filters.violationType);
    if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
    return params.toString();
  };

  useEffect(() => {
    const qs = buildQueryString();
    api.get(`/api/dashboard?${qs}`).then(res => setDashboardStats(res.data)).catch(console.error);
    api.get(`/api/analytics?${qs}`).then(res => setAnalyticsData(res.data)).catch(console.error);
  }, [filters]);

  const handleExportCSV = () => {
    const qs = buildQueryString();
    // Use VITE_API_URL for absolute URL in production; fallback to relative for local dev
    const base = import.meta.env.VITE_API_URL || '';
    window.open(`${base}/api/export/csv?${qs}`, '_blank');
    triggerSuccess('CSV Export initiated successfully.');
  };

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const triggerError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const handleExportPDF = (reportType) => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString();
      const textColor = '#334155';
      const accentColor = '#3b82f6';

      // Header
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 50, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('PARKPULSE AI — OPERATIONS CENTER', 14, 24);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Generated: ${today} | System: Active`, 14, 38);

      doc.setTextColor(textColor);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);

      if (reportType === 'executive') {
        doc.text('EXECUTIVE OPERATIONS SUMMARY', 14, 65);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        let y = 75;
        const intro = 'This report summarizes operational metrics and traffic violation outcomes within the city limits, providing analytics to assist traffic marshals and operations commanders in data-driven scheduling.';
        doc.text(doc.splitTextToSize(intro, 180), 14, y); y += 18;

        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Key Operational Statistics', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        doc.text(`* Total Logged Violations: ${dashboardStats.totalViolations?.toLocaleString() || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Total Validated Approved: ${dashboardStats.approvedViolations?.toLocaleString() || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Total Rejected / Dismissed: ${dashboardStats.rejectedViolations?.toLocaleString() || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Highest Impact Area: ${dashboardStats.highestRiskArea || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Detected Active Hotspots: ${dashboardStats.activeHotspots || 'N/A'}`, 18, y); y += 12;

        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Strategic Recommendations', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(textColor);
        ['1. Deploy automated camera enforcement in the highest-risk corridors to deter repeat offenders.',
         '2. Schedule marshal patrols in 3-hour dynamic shift blocks aligned to local peak times.',
         '3. Audit parking sign visibility at bottleneck intersections for maximum deterrence.'
        ].forEach(rec => {
          const lines = doc.splitTextToSize(rec, 180);
          doc.text(lines, 14, y); y += lines.length * 5.5 + 2;
        });

      } else if (reportType === 'hotspot') {
        doc.text('HOTSPOT DENSITY ANALYSIS REPORT', 14, 65);
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        let y = 75;
        doc.text(doc.splitTextToSize('Spatial density clustering via DBSCAN, highlighting regions with critical vehicle congestion patterns.', 180), 14, y); y += 14;
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Critical Hotspot Ranking (Top Areas)', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        if (analyticsData?.byArea?.length > 0) {
          analyticsData.byArea.slice(0, 6).forEach((area, i) => {
            doc.text(`${i + 1}. Area: ${area.name} | Total: ${area.value?.toLocaleString()} violations`, 18, y); y += 7;
          });
        } else {
          doc.text('No historical area records found. Please upload a dataset first.', 18, y); y += 10;
        }
        y += 5;
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Clustering Parameters', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        doc.text('* Distance Epsilon: 0.005 degrees (~500m radius)', 18, y); y += 6;
        doc.text('* Minimum Core Points: 3 violation samples', 18, y); y += 6;
        doc.text('* Distance Metric: Euclidean Approximation', 18, y);

      } else {
        doc.text('PREDICTIVE CONGESTION RISK REPORT', 14, 65);
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        let y = 75;
        doc.text(doc.splitTextToSize('Congestion prediction metrics from the ML engine using Random Forest Regressors.', 180), 14, y); y += 14;
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Distribution by Vehicle Types', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(textColor);
        if (analyticsData?.byVehicleType?.length > 0) {
          const total = analyticsData.byVehicleType.reduce((sum, item) => sum + (item.value || 0), 0);
          analyticsData.byVehicleType.slice(0, 8).forEach((type) => {
            const pct = ((type.value / Math.max(1, total)) * 100).toFixed(1);
            doc.text(`* ${type.name}: ${type.value?.toLocaleString()} records (${pct}%)`, 18, y); y += 7;
          });
        } else {
          doc.text('No vehicle records found.', 18, y); y += 10;
        }
        y += 5;
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(accentColor);
        doc.text('Random Forest Strategy', 14, y); y += 8;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(textColor);
        const strategy = 'The model aggregates historical data across Location, Vehicle Type, Hour of Day, and Day of Week to compute probability risk metrics, enabling command units to pre-position marshals before congestion peaks.';
        doc.text(doc.splitTextToSize(strategy, 180), 14, y);
      }

      // Footer
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('CONFIDENTIAL — PARKPULSE AI TRAFFIC MANAGEMENT SYSTEM | Page 1', 14, 285);
      doc.save(`ParkPulse_${reportType}_report.pdf`);
      triggerSuccess(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} PDF downloaded.`);
    } catch (err) {
      console.error(err);
      triggerError('Error generating PDF: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-7 h-7 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
        <h1 className="text-xl md:text-2xl font-bold text-white">Operations Reports Center</h1>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 text-red-400 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Reports */}
        <div className="glass-panel p-5 md:p-6">
          <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-2">Generate PDF Reports</h3>
          <p className="text-sm text-slate-400 mb-5">Download professional operations reports with live database analytics.</p>
          <div className="flex flex-col gap-3">
            {[
              { type: 'executive', title: 'Executive Summary Report', desc: 'Key metrics, baseline stats, and marshal suggestions.' },
              { type: 'hotspot',   title: 'Hotspot Analysis Report',  desc: 'Top areas ranking, DBSCAN properties, and core densities.' },
              { type: 'congestion', title: 'Predictive Congestion Report', desc: 'ML features overview and vehicle distribution charts.' },
            ].map(({ type, title, desc }) => (
              <button
                key={type}
                id={`pdf-${type}-btn`}
                onClick={() => handleExportPDF(type)}
                disabled={downloading}
                className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">{title}</span>
                  <span className="text-xs text-slate-500">{desc}</span>
                </div>
                <Download className="w-5 h-5 text-blue-500 flex-shrink-0 ml-3" />
              </button>
            ))}
          </div>
        </div>

        {/* Data Exports */}
        <div className="glass-panel p-5 md:p-6">
          <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-2">Export Datasets</h3>
          <p className="text-sm text-slate-400 mb-5">Download raw database logs matching your active filters.</p>
          <button
            id="csv-export-btn"
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
          >
            <div className="text-left">
              <span className="text-sm font-bold text-white block">CSV Dataset Export</span>
              <span className="text-xs text-slate-500">Streams filtered database records directly to a CSV spreadsheet.</span>
            </div>
            <Download className="w-5 h-5 text-emerald-500 flex-shrink-0 ml-3" />
          </button>

          <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700/30 text-xs text-slate-400 leading-relaxed mt-5">
            <strong>Export Info:</strong> Reports respect global filters (Date, Station, Vehicle Type). Apply filters first to generate scoped outputs.
          </div>
        </div>
      </div>
    </div>
  );
}
