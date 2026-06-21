import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { UploadCloud, Menu, Loader2, Activity, RefreshCw } from 'lucide-react';
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

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm">Connecting to database…</p>
      </div>
    </div>
  );
}

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
          Upload a CSV or Excel parking violation dataset to initialize the dashboards, heatmap, and AI prediction models.
        </p>
        <Link
          to="/upload"
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <UploadCloud className="w-5 h-5" /> Upload Dataset
        </Link>
      </div>
    </div>
  );
}

function ConnectionErrorScreen({ onRetry }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px] p-6">
      <div className="glass-panel p-8 flex flex-col items-center justify-center text-center max-w-md border border-slate-700/50 rounded-2xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 text-red-500">
          <Activity className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
        <p className="text-slate-400 text-sm mb-6">
          Unable to connect to the ParkPulse AI server. Please verify the server is running.
        </p>
        <button
          onClick={onRetry}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Track loading state separately:
  // null = initial (never fetched), true = fetching, false = done
  const [metaLoading, setMetaLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const fetchMetadata = useCallback(() => {
    setMetaLoading(true);
    setConnectionError(false);
    api.get('/api/meta')
      .then(res => {
        const data = res.data;
        setMetadata(data);
        // Persist hasData in sessionStorage so refresh doesn't flash empty state
        const hasData = data.policeStations && data.policeStations.length > 0;
        sessionStorage.setItem('parkpulse_hasdata', hasData ? '1' : '0');
        setMetaLoading(false);
      })
      .catch(err => {
        console.error('Error fetching metadata:', err);
        setConnectionError(true);
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
    setUploadKey(prev => prev + 1);
    // Navigate to dashboard after successful upload
    navigate('/');
  }, [fetchMetadata, navigate]);

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

  // During initial load: use sessionStorage hint to avoid flash of empty state
  const cachedHasData = sessionStorage.getItem('parkpulse_hasdata') === '1';

  // Show filter panel only when data exists and on relevant pages
  const showFilterPanel = hasData && ['/', '/heatmap', '/analytics', '/reports'].includes(location.pathname);

  // Show empty state only after loading completes AND we're sure there's no data
  // Also don't show empty state during initial load if session cache says data exists
  const showEmptyState = !metaLoading && !hasData &&
    ['/', '/heatmap', '/analytics', '/prediction', '/simulation', '/reports'].includes(location.pathname);

  // Show loading screen during initial fetch only if we don't have cached data hint
  const showLoadingScreen = metaLoading && !cachedHasData;

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} hasData={hasData} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        <main className="flex-1 overflow-auto flex flex-col">
          {/* Mobile top navbar */}
          <header className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-surface border-b border-slate-700/50">
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
          {connectionError ? (
            <ConnectionErrorScreen onRetry={fetchMetadata} />
          ) : showLoadingScreen ? (
            <LoadingScreen />
          ) : showEmptyState ? (
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
                <Route path="/admin" element={<AdminPanel onDataCleared={() => {
                  setMetadata({ policeStations: [], vehicleTypes: [], violationTypes: [] });
                  setUploadKey(0);
                  sessionStorage.setItem('parkpulse_hasdata', '0');
                }} />} />
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
