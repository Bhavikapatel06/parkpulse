import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import HeatmapView from './components/HeatmapView';
import AnalyticsView from './components/AnalyticsView';
import PredictionView from './components/PredictionView';
import SimulationView from './components/SimulationView';
import ReportGenerator from './components/ReportGenerator';
import Upload from './components/Upload';
import FilterPanel from './components/FilterPanel';
import AdminPanel from './components/AdminPanel';

function EmptyState({ title }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>
      <div className="glass-panel p-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-12 border border-slate-700/50 rounded-2xl">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/20 text-blue-500">
          <UploadCloud className="w-8 h-8 animate-bounce" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Violation Data Loaded</h3>
        <p className="text-slate-400 text-sm mb-8 max-w-md">
          To initialize predictive modeling, spatial clustering, and operational overview dashboards, please upload a parking violation dataset first.
        </p>
        <Link 
          to="/upload" 
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <UploadCloud className="w-5 h-5" /> Go to Data Upload
        </Link>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    policeStation: '',
    vehicleType: '',
    violationType: '',
    riskLevel: ''
  });

  const [metadata, setMetadata] = useState({
    policeStations: [],
    vehicleTypes: [],
    violationTypes: []
  });
  const [metaLoading, setMetaLoading] = useState(true);

  const fetchMetadata = () => {
    setMetaLoading(true);
    axios.get('/api/meta')
      .then(res => {
        setMetadata(res.data);
        setMetaLoading(false);
      })
      .catch(err => {
        console.error("Error fetching metadata:", err);
        setMetaLoading(false);
      });
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      policeStation: '',
      vehicleType: '',
      violationType: '',
      riskLevel: ''
    });
  };

  const hasData = metadata.policeStations && metadata.policeStations.length > 0;
  const showFilterPanel = hasData && ['/', '/heatmap', '/analytics', '/reports'].includes(location.pathname);
  const showEmptyState = !metaLoading && !hasData && ['/', '/heatmap', '/analytics', '/prediction', '/simulation', '/reports'].includes(location.pathname);

  // Get Page Title for Empty State
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Command Center Overview';
      case '/heatmap': return 'Live AI Hotspot Heatmap';
      case '/analytics': return 'Analytics Dashboard';
      case '/prediction': return 'Congestion Risk Prediction';
      case '/simulation': return 'Event Impact Simulator';
      case '/reports': return 'Operations Reports Center';
      case '/admin': return 'Admin Control Panel';
      default: return 'ParkPulse AI Dashboard';
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        {showEmptyState ? (
          <EmptyState title={getPageTitle()} />
        ) : (
          <>
            {showFilterPanel && (
              <div className="px-6 pt-6">
                <FilterPanel 
                  filters={filters} 
                  onChange={setFilters} 
                  onClear={handleClearFilters} 
                  metadata={metadata}
                />
              </div>
            )}
            <Routes>
              <Route path="/" element={<Dashboard filters={filters} />} />
              <Route path="/heatmap" element={<HeatmapView filters={filters} />} />
              <Route path="/analytics" element={<AnalyticsView filters={filters} />} />
              <Route path="/prediction" element={<PredictionView metadata={metadata} />} />
              <Route path="/simulation" element={<SimulationView metadata={metadata} />} />
              <Route path="/reports" element={<ReportGenerator filters={filters} />} />
              <Route path="/upload" element={<Upload onUploadSuccess={fetchMetadata} />} />
              <Route path="/admin" element={<AdminPanel onDataCleared={() => { setMetadata({ policeStations: [], vehicleTypes: [], violationTypes: [] }); }} />} />
            </Routes>
          </>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
