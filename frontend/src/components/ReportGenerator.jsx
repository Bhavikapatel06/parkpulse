import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import axios from 'axios';
import { Download, FileText, CheckCircle } from 'lucide-react';

export default function ReportGenerator({ filters }) {
  const [downloading, setDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
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
    const queryString = buildQueryString();
    axios.get(`/api/dashboard?${queryString}`)
      .then(res => setDashboardStats(res.data))
      .catch(console.error);
    axios.get(`/api/analytics?${queryString}`)
      .then(res => setAnalyticsData(res.data))
      .catch(console.error);
  }, [filters]);

  const handleExportCSV = () => {
    const queryString = buildQueryString();
    window.open(`${axios.defaults.baseURL || ''}/api/export/csv?${queryString}`, '_blank');
    triggerSuccess('CSV Export initiated successfully.');
  };

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleExportPDF = (reportType) => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString();

      // Premium Styling Colors
      const primaryColor = '#1e293b'; // Slate 800
      const accentColor = '#3b82f6';  // Blue 500
      const textColor = '#334155';    // Slate 700

      // Title Page
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('PARKIMPACT-AI OPERATIONS CENTER', 14, 25);
      
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Generated on: ${today} | System Status: Active`, 14, 38);

      // Body Section
      doc.setTextColor(primaryColor);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);

      if (reportType === 'executive') {
        doc.text('EXECUTIVE OPERATIONS SUMMARY', 14, 65);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        
        let y = 75;
        const introText = 'This report summarizes the operational metrics and traffic violation outcomes within the city limits, providing an analytics overview to assist traffic marshals and operations commanders in data-driven scheduling.';
        const splitIntro = doc.splitTextToSize(introText, 180);
        doc.text(splitIntro, 14, y);
        y += 15;

        // Statistics Block
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Key Operational Statistics', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        doc.text(`* Total Logged Violations: ${dashboardStats.totalViolations || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Total Validated Approved: ${dashboardStats.approvedViolations || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Total Rejected / Dismissed: ${dashboardStats.rejectedViolations || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Highest Impact Area (Highest Violations): ${dashboardStats.highestRiskArea || 'N/A'}`, 18, y); y += 6;
        doc.text(`* Detected Density Active Hotspots: ${dashboardStats.activeHotspots || 'N/A'}`, 18, y); y += 12;

        // Recommendations Section
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Strategic Actionable Recommendations', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(textColor);
        
        const recs = [
          '1. Deploy Automated Enforcement: Transition the highest risk areas into automated camera surveillance corridors to deter repeat offenders.',
          '2. Align Marshall Patrol Schedules: Schedule marshal patrols dynamically in 3-hour shift blocks corresponding to local peak times.',
          '3. Signage Inspection: Audit physical parking sign visibility at local bottleneck intersections to ensure warning visibility.'
        ];
        
        recs.forEach(rec => {
          const splitText = doc.splitTextToSize(rec, 180);
          doc.text(splitText, 14, y);
          y += splitText.length * 5 + 2;
        });

      } else if (reportType === 'hotspot') {
        doc.text('HOTSPOT DENSITY ANALYSIS REPORT', 14, 65);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        
        let y = 75;
        const introText = 'This details spatial density clustering mapped via the DBSCAN clustering model, highlighting regions with critical vehicle congestion patterns.';
        const splitIntro = doc.splitTextToSize(introText, 180);
        doc.text(splitIntro, 14, y);
        y += 15;

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Critical Hotspot Ranking (Top Areas)', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);

        if (analyticsData && analyticsData.byArea && analyticsData.byArea.length > 0) {
          analyticsData.byArea.slice(0, 6).forEach((area, index) => {
            doc.text(`${index + 1}. Area: ${area.name} | Total Logged: ${area.value} violations`, 18, y);
            y += 7;
          });
        } else {
          doc.text('No historical area records found. Please upload a dataset first.', 18, y);
          y += 10;
        }

        y += 5;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Clustering Parameters', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        doc.text('* Spatial Distance Epsilon: 0.005 degrees (~500 meters radius)', 18, y); y += 6;
        doc.text('* Minimum Cluster Core Points: 3 core violation samples', 18, y); y += 6;
        doc.text('* Distance Metric: Euclidean Distance Approximation', 18, y);

      } else {
        // Congestion Report
        doc.text('PREDICTIVE CONGESTION RISK REPORT', 14, 65);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        
        let y = 75;
        const introText = 'This report outlines congestion prediction metrics generated by the machine learning engine using Random Forest Regressors.';
        const splitIntro = doc.splitTextToSize(introText, 180);
        doc.text(splitIntro, 14, y);
        y += 15;

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Distribution by Vehicle Types (Historical Baseline)', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);

        if (analyticsData && analyticsData.byVehicleType && analyticsData.byVehicleType.length > 0) {
          const total = analyticsData.byVehicleType.reduce((sum, item) => sum + (item.value || 0), 0);
          analyticsData.byVehicleType.slice(0, 6).forEach((type, index) => {
            const percentage = ((type.value / Math.max(1, total)) * 100).toFixed(1);
            doc.text(`* ${type.name}: ${type.value.toLocaleString()} records (${percentage}%)`, 18, y);
            y += 7;
          });
        } else {
          doc.text('No historical vehicle records found.', 18, y);
          y += 10;
        }

        y += 5;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(accentColor);
        doc.text('Random Forest Estimations Strategy', 14, y);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        
        const strategy = 'The predictive model aggregates historical datasets across 4 feature dimensions (Location, Vehicle Type, Hour of Day, Day of Week) to compute probability risk metrics. The output helps command units shift marshals proactively prior to congestion peaks.';
        const splitStrategy = doc.splitTextToSize(strategy, 180);
        doc.text(splitStrategy, 14, y);
      }

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`CONFIDENTIAL - PARKIMPACT-AI TRAFFIC MANAGEMENT SYSTEM | Page 1`, 14, 285);

      doc.save(`ParkImpact_${reportType}_report.pdf`);
      triggerSuccess(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report PDF downloaded successfully.`);
    } catch(err) {
      console.error(err);
      alert('Error generating PDF report: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Operations Reports Center</h1>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500 text-emerald-500 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Reports Generation Panel */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-2">Generate PDF Reports</h3>
            <p className="text-sm text-slate-400 mb-6">Download professional operations reports compiled with active database analytics.</p>
            
            <div className="flex flex-col gap-4">
              {/* Executive Summary Button */}
              <button
                onClick={() => handleExportPDF('executive')}
                disabled={downloading}
                className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
              >
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">Executive Summary Report</span>
                  <span className="text-xs text-slate-500">Key metrics, baseline stats, and marshal suggestions.</span>
                </div>
                <Download className="w-5 h-5 text-blue-500" />
              </button>

              {/* Hotspot Analysis Button */}
              <button
                onClick={() => handleExportPDF('hotspot')}
                disabled={downloading}
                className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
              >
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">Hotspot Analysis Report</span>
                  <span className="text-xs text-slate-500">Top areas ranking, DBSCAN properties, and core densities.</span>
                </div>
                <Download className="w-5 h-5 text-blue-500" />
              </button>

              {/* Congestion Prediction Button */}
              <button
                onClick={() => handleExportPDF('congestion')}
                disabled={downloading}
                className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
              >
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">Predictive Congestion Report</span>
                  <span className="text-xs text-slate-500">ML features overview and vehicle distribution charts.</span>
                </div>
                <Download className="w-5 h-5 text-blue-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Exports Panel */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-2">Export Datasets</h3>
            <p className="text-sm text-slate-400 mb-6">Download raw database logs matching your active filters for external tool integrations.</p>

            <div className="flex flex-col gap-4">
              {/* CSV Export Button */}
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
              >
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">CSV Dataset Export</span>
                  <span className="text-xs text-slate-500">Streams currently filtered database logs directly to a CSV spreadsheet.</span>
                </div>
                <Download className="w-5 h-5 text-emerald-500" />
              </button>
            </div>
          </div>

          <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700/30 text-xs text-slate-400 leading-relaxed mt-6">
            <strong>Export Info:</strong> Reports and exports respect the global filters applied in the command panel header (Date ranges, Police Stations, and Vehicle Types). Apply filters first before exporting to generate scoped outputs.
          </div>
        </div>
      </div>
    </div>
  );
}
