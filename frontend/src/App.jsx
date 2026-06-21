import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { UploadCloud, Menu, X } from 'lucide-react';
import api from './lib/api';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // uploadKey increments after every successful upload, triggering child re-fetches
  const [uploadKey, setUploadKey] = useState(0);

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

  const fetchMetadata = useCallback(() => {
    setMetaLoading(true);
    api.get('/api/meta')
      .then(res => {
        setMetadata(res.data);
        setMetaLoading(false);
      })
      .catch(err => {
        console.error('Error fetching metadata:', err);
        setMetaLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleUploadSuccess = useCallback(() => {
    fetchMetadata();
    setUploadKey(prev => prev + 1); // Triggers Dashboard, HeatmapView, AnalyticsView re-fetch
  }, [fetchMetadata]);

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
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        {/* Mobile top navbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-slate-700/50 sticky top-0 z-10">
          <button
            id="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-white font-bold text-sm">ParkPulse AI</span>
          <div className="w-9" /> {/* spacer */}
        </header>

        <main className="flex-1 overflow-auto">
          {showEmptyState ? (
            <EmptyState title={getPageTitle()} />
          ) : (
            <>
              {showFilterPanel && (
                <div className="px-4 md:px-6 pt-4 md:pt-6">
                  <FilterPanel
                    filters={filters}
                    onChange={setFilters}
                    onClear={handleClearFilters}
                    metadata={metadata}
                  />
                </div>
              )}
              <Routes>
                <Route path="/" element={<Dashboard filters={filters} uploadKey={uploadKey} />} />
                <Route path="/heatmap" element={<HeatmapView filters={filters} uploadKey={uploadKey} />} />
                <Route path="/analytics" element={<AnalyticsView filters={filters} uploadKey={uploadKey} />} />
                <Route path="/prediction" element={<PredictionView metadata={metadata} />} />
                <Route path="/simulation" element={<SimulationView metadata={metadata} />} />
                <Route path="/reports" element={<ReportGenerator filters={filters} />} />
                <Route path="/upload" element={<Upload onUploadSuccess={handleUploadSuccess} />} />
                <Route path="/admin" element={<AdminPanel onDataCleared={() => { setMetadata({ policeStations: [], vehicleTypes: [], violationTypes: [] }); setUploadKey(0); }} />} />
              </Routes>
            </>
          )}
        </main>
      </div>
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
