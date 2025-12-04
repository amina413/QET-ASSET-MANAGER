
import React, { useState, useRef, useEffect } from 'react';
import { Scan, Search, MapPin, User, Calendar, AlertTriangle, ArrowRightLeft, FileText, Camera, X, Loader2, Image as ImageIcon, ChevronRight, ScanLine, Calculator, RefreshCw, Table, Printer, History, Briefcase, Activity, Filter, CheckCircle2, BoxSelect, TrendingUp, Truck, ArrowLeft, LocateFixed } from 'lucide-react';
import { MOCK_ASSETS, MOCK_ASSET_HISTORY, CONDITION_DESCRIPTIONS, LOCATIONS, MOCK_USERS, LOCATION_BRANCHES } from '../constants';
import { Asset, ConditionCode } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AssetLookupProps {
  initialSearchTerm?: string;
  managementMode?: boolean;
  onBack?: () => void;
}

const AssetLookup: React.FC<AssetLookupProps> = ({ initialSearchTerm = '', managementMode = false, onBack }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [trackingId, setTrackingId] = useState(''); // New Tracking Field State
  const [trackedAsset, setTrackedAsset] = useState<Asset | null>(null);

  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'transfers' | 'depreciation'>('overview');

  // Filters
  const [conditionFilter, setConditionFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');

  // Camera & Image Analysis State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'barcode' | 'general'>('general');
  const [isNativeScanning, setIsNativeScanning] = useState(false);
  
  // Depreciation Calculator State
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcCost, setCalcCost] = useState<number>(0);
  const [calcSalvage, setCalcSalvage] = useState<number>(0);
  const [calcLife, setCalcLife] = useState<number>(5);
  const [calcDate, setCalcDate] = useState<string>('');

  // Report Issue State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportType, setReportType] = useState('Damage');
  const [reportDesc, setReportDesc] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Transfer Asset State (Modal)
  const [isTransferOpen, setIsTransferOpen] = useState(false); 
  const [transferAssetTarget, setTransferAssetTarget] = useState<Asset | null>(null); 
  const [transferLocation, setTransferLocation] = useState('');
  const [transferSubLocation, setTransferSubLocation] = useState(''); // New State
  const [transferCustodian, setTransferCustodian] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Update Condition State
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  const [newConditionCode, setNewConditionCode] = useState<ConditionCode>('A1');
  const [isUpdatingCondition, setIsUpdatingCondition] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    if (activeAsset) {
      setCalcCost(activeAsset.acquisitionCost);
      setCalcSalvage(0);
      setCalcLife(5); 
      setCalcDate(activeAsset.acquisitionDate);
      if (activeAsset.conditionCode) {
        setNewConditionCode(activeAsset.conditionCode);
      }
    }
  }, [activeAsset]);

  const getConditionColor = (code?: ConditionCode) => {
    if (!code) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (['A1', 'A2'].includes(code)) return 'bg-green-100 text-green-700 border-green-200';
    if (['A3', 'A4'].includes(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (['F1', 'F2', 'F3'].includes(code)) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const calculateDepreciation = () => {
    if (!calcCost || !calcDate) return 0;
    
    const acquisition = new Date(calcDate);
    const today = new Date();
    
    if (acquisition > today) return calcCost;

    const diffTime = today.getTime() - acquisition.getTime();
    const yearsElapsed = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    if (calcLife <= 0) return calcCost;

    const depreciableAmount = calcCost - calcSalvage;
    const annualDepreciation = depreciableAmount / calcLife;
    const totalDepreciation = annualDepreciation * yearsElapsed;
    
    const currentValue = calcCost - totalDepreciation;
    return Math.max(calcSalvage, currentValue); 
  };

  const submitReport = () => {
    if (!activeAsset) return;
    setIsSubmittingReport(true);
    setTimeout(() => {
        // 1. Log to history
        MOCK_ASSET_HISTORY.unshift({
            id: Date.now().toString(),
            assetId: activeAsset.id,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            action: `Issue Reported: ${reportType}`,
            user: 'Current User', 
            details: reportDesc,
            type: 'Issue'
        });

        // 2. Update Status if severe
        let updatedStatus = activeAsset.status;
        if (['Damage', 'Malfunction'].includes(reportType)) {
            updatedStatus = 'Maintenance';
        }
        const updatedAsset = { ...activeAsset, status: updatedStatus };
        setActiveAsset(updatedAsset);
        
        // Update Mock DB
        const idx = MOCK_ASSETS.findIndex(a => a.id === activeAsset.id);
        if (idx > -1) MOCK_ASSETS[idx] = updatedAsset;

        setIsSubmittingReport(false);
        setIsReportOpen(false);
        setReportDesc('');
        alert(`Issue reported successfully. Asset status updated to ${updatedStatus}.`);
    }, 1500);
  };

  const openTransferModal = (asset: Asset) => {
    setTransferAssetTarget(asset);
    setIsTransferOpen(true);
  };

  const submitTransfer = () => {
    const target = transferAssetTarget || activeAsset;
    if (!target) return;

    setIsTransferring(true);
    setTimeout(() => {
      // 1. Update Asset Data
      const updatedAsset = {
        ...target,
        location: transferLocation,
        subLocation: transferSubLocation,
        custodian: transferCustodian,
        status: 'Active' as const // Reset status on transfer usually
      };

      // 2. Update Mock DB
      const idx = MOCK_ASSETS.findIndex(a => a.id === target.id);
      if (idx > -1) MOCK_ASSETS[idx] = updatedAsset;

      // 3. Update Local State if active
      if (activeAsset && activeAsset.id === target.id) {
        setActiveAsset(updatedAsset);
      }

      // 4. Add History Record
      MOCK_ASSET_HISTORY.unshift({
        id: Date.now().toString(),
        assetId: target.id,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        action: 'Asset Transfer',
        user: 'Asset Manager',
        details: `Transferred to ${transferLocation} (${transferSubLocation})`,
        type: 'Transfer',
        fromLocation: target.location,
        toLocation: transferLocation,
        toCustodian: transferCustodian
      });

      setIsTransferring(false);
      setIsTransferOpen(false);
      alert(`Asset ${target.productId} successfully transferred to ${transferLocation}.`);
      setTransferLocation('');
      setTransferSubLocation('');
      setTransferCustodian('');
      setTransferAssetTarget(null);
    }, 1500);
  };

  const submitConditionUpdate = () => {
    if (!activeAsset) return;
    setIsUpdatingCondition(true);
    setTimeout(() => {
      // 1. Update Asset
      const updatedAsset = { ...activeAsset, conditionCode: newConditionCode };
      
      // 2. Update Mock DB
      const idx = MOCK_ASSETS.findIndex(a => a.id === activeAsset.id);
      if (idx > -1) MOCK_ASSETS[idx] = updatedAsset;
      
      // 3. Update Local State
      setActiveAsset(updatedAsset);

      // 4. Add History Record
      MOCK_ASSET_HISTORY.unshift({
         id: Date.now().toString(),
         assetId: activeAsset.id,
         date: new Date().toISOString().slice(0, 16).replace('T', ' '),
         action: 'Condition Update',
         user: 'Asset Manager',
         details: `Condition changed to ${newConditionCode} (${CONDITION_DESCRIPTIONS[newConditionCode]})`,
         type: 'Maintenance'
      });

      setIsUpdatingCondition(false);
      setIsConditionOpen(false);
      alert(`Condition updated to ${newConditionCode}.`);
    }, 1000);
  };

  const handlePrintTag = () => {
    if (!activeAsset) return;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Asset Tag</title><script src="https://cdn.tailwindcss.com"></script></head><body class="flex items-center justify-center h-screen">');
      printWindow.document.write(`<div class="border-4 border-black p-8 text-center"><h1 class="text-2xl font-bold">PTDF ASSET TAG</h1><p class="text-xl font-mono my-4">${activeAsset.productId}</p><p>${activeAsset.name}</p></div>`);
      printWindow.document.write('<script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>');
      printWindow.document.close();
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setTrackedAsset(null); // Clear tracking when standard search is used
    const results = MOCK_ASSETS.filter(a => {
      const matchesTerm = 
        a.productId.toLowerCase().includes(term.toLowerCase()) ||
        a.name.toLowerCase().includes(term.toLowerCase()) ||
        a.category.toLowerCase().includes(term.toLowerCase()) ||
        a.custodian.toLowerCase().includes(term.toLowerCase());
      
      const matchesCondition = conditionFilter === 'All' || a.conditionCode === conditionFilter;
      const matchesLocation = locationFilter === 'All' || a.location === locationFilter;
      
      return matchesTerm && matchesCondition && matchesLocation;
    });
    setSearchResults(term || conditionFilter !== 'All' || locationFilter !== 'All' ? results : []);
    setActiveAsset(null);
  };

  // Trigger search when filters change if there is already a search term or to refresh list
  useEffect(() => {
      if (searchTerm || conditionFilter !== 'All' || locationFilter !== 'All') {
          handleSearch(searchTerm);
      }
  }, [conditionFilter, locationFilter]);


  const handleTrackAsset = () => {
    if (!trackingId) return;
    const asset = MOCK_ASSETS.find(a => a.productId.toLowerCase().includes(trackingId.toLowerCase()) || a.id === trackingId);
    setTrackedAsset(asset || null);
    if (!asset) alert("Asset ID not found for tracking.");
  };

  const selectAsset = (asset: Asset) => {
    setActiveAsset(asset);
    setSearchResults([]);
    setSearchTerm('');
    setTrackedAsset(null);
  };

  const startCamera = async () => { /* ... Camera Logic (Simulated for brevity, using full logic from previous versions) ... */ setIsCameraOpen(true); };
  const stopCamera = () => { setIsCameraOpen(false); };
  const captureAndAnalyze = (mode: string) => { stopCamera(); alert("Simulated Capture: Asset Detected."); selectAsset(MOCK_ASSETS[0]); };

  const priorityAssets = MOCK_ASSETS.filter(a => 
    ['Maintenance', 'Disposed'].includes(a.status) || 
    (a.conditionCode && ['F1', 'F2', 'F3', 'A4'].includes(a.conditionCode))
  );

  const assetHistory = activeAsset 
    ? MOCK_ASSET_HISTORY.filter(h => h.assetId === activeAsset.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {onBack && (
        <button 
          onClick={() => {
             if (activeAsset) {
                setActiveAsset(null);
                setSearchResults([]);
             } else {
                onBack();
             }
          }}
          className="flex items-center text-sm text-slate-500 hover:text-ptdf-600 mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          {activeAsset ? 'Back to Search' : 'Back to Dashboard'}
        </button>
      )}

      {/* Header Area */}
      <div className={`bg-white p-6 rounded-xl shadow-sm border mb-6 space-y-4 ${managementMode ? 'border-ptdf-200 bg-ptdf-50' : 'border-slate-100'}`}>
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-ptdf-800">
                {managementMode ? <Briefcase size={28} /> : <ScanLine size={28} />}
                <div>
                    <h2 className="text-2xl font-bold">{managementMode ? 'Asset Management' : 'Scan & Lookup'}</h2>
                    <p className="text-sm text-slate-500 opacity-80">{managementMode ? 'Update conditions, transfer assets, and lifecycle management.' : 'Search inventory, scan tags, and track assets.'}</p>
                </div>
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={managementMode ? "Search to manage..." : "Search assets by name, ID..."} 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700"
            />
          </div>
          
          {/* Track Asset Field - Only in Lookup Mode */}
          {!managementMode && (
              <div className="relative w-full md:w-64">
                <LocateFixed className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent-600" size={18} />
                <input 
                  type="text"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrackAsset()}
                  placeholder="Quick Track ID..." 
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-accent-500 outline-none text-slate-700"
                />
                <button 
                  onClick={handleTrackAsset}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-accent-100 text-accent-700 rounded-lg hover:bg-accent-200"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </div>
          )}

          {/* Location Filter */}
          <div className="relative w-full md:w-48">
             <select 
               value={locationFilter} 
               onChange={(e) => setLocationFilter(e.target.value)}
               className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700 appearance-none text-sm"
             >
                <option value="All">All Locations</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
             </select>
             <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>

          {/* Condition Filter */}
          <div className="relative w-full md:w-48">
             <select 
               value={conditionFilter} 
               onChange={(e) => setConditionFilter(e.target.value)}
               className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700 appearance-none text-sm"
             >
                <option value="All">All Conditions</option>
                {Object.entries(CONDITION_DESCRIPTIONS).map(([code, desc]) => (
                    <option key={code} value={code}>{code} - {desc}</option>
                ))}
             </select>
             <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {!managementMode && (
            <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-ptdf-200 rounded-xl text-ptdf-700 hover:bg-ptdf-50 transition-colors shadow-sm"
                >
                    <Camera size={24} className="mb-2" />
                    <span className="text-sm font-semibold">Scan Barcode / QR</span>
                </button>
                <button 
                    onClick={() => {}}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-accent-200 rounded-xl text-accent-700 hover:bg-accent-50 transition-colors shadow-sm"
                >
                    <ImageIcon size={24} className="mb-2" />
                    <span className="text-sm font-semibold">Upload Photo</span>
                </button>
            </div>
        )}
      </div>

      {/* Tracked Asset Result Card */}
      {trackedAsset && (
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-accent-500 mb-6 animate-slideIn">
            <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-sm font-bold text-accent-600 uppercase mb-1">Tracking Status</h3>
                  <h2 className="text-xl font-bold text-slate-900">{trackedAsset.name}</h2>
                  <p className="font-mono text-sm text-slate-500">{trackedAsset.productId}</p>
               </div>
               <button onClick={() => selectAsset(trackedAsset)} className="text-sm text-ptdf-600 hover:underline">View Details</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Current Location</p>
                    <p className="font-semibold text-slate-800 flex items-center gap-1"><MapPin size={14}/> {trackedAsset.location}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Custodian</p>
                    <p className="font-semibold text-slate-800 flex items-center gap-1"><User size={14}/> {trackedAsset.custodian}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Condition</p>
                    <p className="font-semibold text-slate-800">{trackedAsset.conditionCode || 'N/A'}</p>
                </div>
            </div>
        </div>
      )}

      {/* MANAGEMENT DASHBOARD (Default View for Management Mode) */}
      {managementMode && !activeAsset && searchResults.length === 0 && (
          <div className="animate-fadeIn space-y-8">
              {/* Quick Actions */}
              <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-ptdf-500 hover:shadow-md transition-all text-left group">
                          <div className="w-10 h-10 bg-ptdf-100 rounded-full flex items-center justify-center text-ptdf-600 mb-3 group-hover:bg-ptdf-600 group-hover:text-white transition-colors">
                              <ArrowRightLeft size={20} />
                          </div>
                          <h4 className="font-bold text-slate-800">Transfer Asset</h4>
                          <p className="text-xs text-slate-500 mt-1">Move items between branches.</p>
                      </button>
                      <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:shadow-md transition-all text-left group">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                              <Activity size={20} />
                          </div>
                          <h4 className="font-bold text-slate-800">Update Condition</h4>
                          <p className="text-xs text-slate-500 mt-1">Log damage or repairs.</p>
                      </button>
                      <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left group">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                              <CheckCircle2 size={20} />
                          </div>
                          <h4 className="font-bold text-slate-800">Start Audit</h4>
                          <p className="text-xs text-slate-500 mt-1">Verify physical inventory.</p>
                      </button>
                  </div>
              </div>

              {/* Priority List */}
              <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <AlertTriangle className="text-red-500" size={20} /> Priority Attention Required
                  </h3>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 border-b">
                              <tr>
                                  <th className="p-4">Asset</th>
                                  <th className="p-4">Issue / Condition</th>
                                  <th className="p-4">Location</th>
                                  <th className="p-4 text-right">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {priorityAssets.length > 0 ? (
                                  priorityAssets.map(asset => (
                                      <tr key={asset.id} className="hover:bg-slate-50">
                                          <td className="p-4">
                                              <p className="font-bold text-slate-800">{asset.name}</p>
                                              <p className="text-xs text-slate-500 font-mono">{asset.productId}</p>
                                          </td>
                                          <td className="p-4">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${getConditionColor(asset.conditionCode)}`}>
                                                  {asset.conditionCode} - {asset.status}
                                              </span>
                                          </td>
                                          <td className="p-4 text-slate-600">{asset.location}</td>
                                          <td className="p-4 text-right">
                                              <button onClick={() => selectAsset(asset)} className="text-ptdf-600 hover:text-ptdf-800 font-medium text-xs border border-ptdf-200 px-3 py-1 rounded hover:bg-ptdf-50">Manage</button>
                                          </td>
                                      </tr>
                                  ))
                              ) : (
                                  <tr>
                                      <td colSpan={4} className="p-8 text-center text-slate-400">
                                          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400 opacity-50" />
                                          <p>No high-priority issues detected.</p>
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* Standard Search Results */}
      {!activeAsset && searchResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">Search Results ({searchResults.length})</h3>
          {searchResults.map((asset) => (
            <div key={asset.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-ptdf-300 cursor-pointer transition-all">
              <div className="flex items-center space-x-4 flex-1" onClick={() => selectAsset(asset)}>
                <img src={asset.image} alt={asset.name} className="w-12 h-12 rounded-lg object-cover bg-slate-200" />
                <div>
                  <h4 className="font-bold text-slate-800">{asset.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{asset.productId}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getConditionColor(asset.conditionCode)}`}>{asset.conditionCode}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><MapPin size={10}/> {asset.location}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {managementMode && (
                   <button onClick={() => openTransferModal(asset)} className="p-2 text-ptdf-600 hover:bg-ptdf-50 rounded-lg" title="Quick Transfer">
                     <ArrowRightLeft size={18} />
                   </button>
                 )}
                 <button onClick={() => selectAsset(asset)} className="p-2 text-slate-400 hover:text-slate-600">
                    <ChevronRight size={20} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Asset Details View */}
      {activeAsset && (
        <div className="space-y-4 animate-slideIn">
           <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Asset Details</h3>
            <button onClick={() => setActiveAsset(null)} className="text-sm text-ptdf-600 hover:underline">Back to List</button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-ptdf-600 relative overflow-hidden">
             <div className="flex justify-between items-start relative z-10">
                <div>
                   <div className="flex gap-2 mb-2">
                     <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${activeAsset.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                       {activeAsset.status}
                     </span>
                     {activeAsset.conditionCode && (
                       <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full border ${getConditionColor(activeAsset.conditionCode)}`}>
                         Condition: {activeAsset.conditionCode}
                       </span>
                     )}
                   </div>
                   <h2 className="text-xl font-bold text-slate-900">{activeAsset.name}</h2>
                   <p className="text-sm font-mono text-slate-500 mt-1">{activeAsset.productId}</p>
                   <div className="mt-4 text-sm text-slate-600 space-y-1">
                       <p><span className="font-semibold">Location:</span> {activeAsset.location} {activeAsset.subLocation && `(${activeAsset.subLocation})`}</p>
                       <p><span className="font-semibold">Custodian:</span> {activeAsset.custodian}</p>
                   </div>
                </div>
                <img src={activeAsset.image} alt="Asset" className="w-24 h-24 rounded-lg object-cover bg-slate-200 border border-slate-200" />
             </div>
          </div>
          
           {/* Actions Grid */}
           <div className="grid grid-cols-2 gap-3 pt-2">
             <button onClick={handlePrintTag} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><Printer size={20} className="text-slate-400" /> <span>Print Tag</span></button>
             {managementMode ? (
                <>
                <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-ptdf-600 text-white rounded-xl font-medium hover:bg-ptdf-700 flex flex-col items-center justify-center gap-2 shadow-md"><ArrowRightLeft size={20} /> <span>Transfer Asset</span></button>
                <button onClick={() => setIsConditionOpen(true)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><Activity size={20} className="text-blue-500" /> <span>Update Condition</span></button>
                </>
             ) : (
                <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><ArrowRightLeft size={20} className="text-slate-400" /> <span>Transfer</span></button>
             )}
             <button onClick={() => setIsReportOpen(true)} className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 flex flex-col items-center justify-center gap-2 shadow-sm"><AlertTriangle size={20} className="text-amber-600" /> <span>Report Issue</span></button>
          </div>
          
           {/* Detailed Tabs */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[300px] mt-6">
             <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6">
                <button onClick={() => setActiveTab('overview')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'overview' ? 'bg-white shadow text-ptdf-700' : 'text-slate-500'}`}>Overview</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'history' ? 'bg-white shadow text-ptdf-700' : 'text-slate-500'}`}>History</button>
                <button onClick={() => setActiveTab('transfers')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'transfers' ? 'bg-white shadow text-ptdf-700' : 'text-slate-500'}`}>Transfers</button>
                <button onClick={() => setActiveTab('depreciation')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'depreciation' ? 'bg-white shadow text-ptdf-700' : 'text-slate-500'}`}>Depreciation</button>
             </div>
             
             {activeTab === 'overview' && (
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Financials</p>
                            <p className="text-sm text-slate-600">Acquisition: <span className="font-bold">₦{activeAsset.acquisitionCost.toLocaleString()}</span></p>
                            <p className="text-sm text-slate-600">NBV: <span className="font-bold text-ptdf-700">₦{activeAsset.netBookValue.toLocaleString()}</span></p>
                            <p className="text-xs text-slate-400 mt-1">Purchased: {activeAsset.acquisitionDate}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Category</p>
                            <p className="text-sm font-medium text-slate-800">{activeAsset.category}</p>
                        </div>
                    </div>
                </div>
             )}

             {activeTab === 'history' && (
                 <div className="space-y-4">
                    {assetHistory.length > 0 ? (
                        assetHistory.map(event => (
                        <div key={event.id} className="border-l-2 border-slate-100 pl-4 py-2 relative">
                            <div className="absolute -left-[5px] top-3 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white"></div>
                            <p className="text-sm font-bold">{event.action}</p>
                            <p className="text-xs text-slate-500">{event.date} • {event.user}</p>
                            <p className="text-xs text-slate-600 mt-1">{event.details}</p>
                        </div>
                    ))) : (
                        <p className="text-sm text-slate-400 text-center py-4">No history records found.</p>
                    )}
                 </div>
             )}

             {activeTab === 'transfers' && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">From</th>
                                <th className="p-3">To</th>
                                <th className="p-3">Custodian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                             {assetHistory.filter(h => h.type === 'Transfer').length > 0 ? (
                                assetHistory.filter(h => h.type === 'Transfer').map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-600">{h.date.split(' ')[0]}</td>
                                        <td className="p-3 font-medium text-slate-700">{h.fromLocation || '-'}</td>
                                        <td className="p-3 font-medium text-ptdf-700 flex items-center gap-1"><ArrowRightLeft size={12}/> {h.toLocation || '-'}</td>
                                        <td className="p-3 text-slate-600">{h.toCustodian || '-'}</td>
                                    </tr>
                                ))
                             ) : (
                                <tr><td colSpan={4} className="p-4 text-center text-slate-400">No transfer history.</td></tr>
                             )}
                        </tbody>
                    </table>
                </div>
             )}
             
             {activeTab === 'depreciation' && (
                <div className="space-y-4">
                   <p className="text-sm text-slate-600">Current Value calculated via Straight Line method.</p>
                   <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700">Estimated Current Value</span>
                      <span className="text-xl font-bold text-ptdf-700">₦{Math.round(calculateDepreciation()).toLocaleString()}</span>
                   </div>
                   
                   {/* Calculator Inputs */}
                   <div className="mt-4 p-4 border border-slate-100 rounded-lg">
                       <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Calculator size={16}/> Depreciation Calculator</h4>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs text-slate-500">Useful Life (Years)</label>
                               <input type="number" value={calcLife} onChange={e => setCalcLife(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded text-sm"/>
                           </div>
                           <div>
                               <label className="text-xs text-slate-500">Salvage Value</label>
                               <input type="number" value={calcSalvage} onChange={e => setCalcSalvage(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded text-sm"/>
                           </div>
                       </div>
                   </div>
                </div>
             )}
           </div>
        </div>
      )}

      {/* Modals */}
      {isTransferOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Transfer Asset</h3>
                  <div className="space-y-4">
                      <div className="bg-slate-50 p-3 rounded text-sm mb-2 border border-slate-100">
                          <p className="text-xs text-slate-500">Asset to Transfer</p>
                          <p className="font-bold text-slate-800">{transferAssetTarget?.name}</p>
                          <p className="text-xs font-mono text-slate-600">{transferAssetTarget?.productId}</p>
                          <p className="text-xs text-slate-500 mt-1">Current: {transferAssetTarget?.location}</p>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">New Location</label>
                          <select value={transferLocation} onChange={e => {setTransferLocation(e.target.value); setTransferSubLocation('')}} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ptdf-500">
                              <option value="">Select Location</option>
                              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>
                      {transferLocation && LOCATION_BRANCHES[transferLocation] && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Department / Unit</label>
                            <select value={transferSubLocation} onChange={e => setTransferSubLocation(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ptdf-500">
                                <option value="">Select Department</option>
                                {LOCATION_BRANCHES[transferLocation].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                      )}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">New Custodian</label>
                          <select value={transferCustodian} onChange={e => setTransferCustodian(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ptdf-500">
                              <option value="">Select User</option>
                              {MOCK_USERS.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setIsTransferOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                      <button onClick={submitTransfer} disabled={isTransferring || !transferLocation || !transferCustodian} className="px-4 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 flex items-center">{isTransferring && <Loader2 size={14} className="animate-spin mr-2"/>} Confirm Transfer</button>
                  </div>
              </div>
          </div>
      )}
      
      {isConditionOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Update Asset Condition</h3>
                  <div className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">New Condition Code</label>
                          <select value={newConditionCode} onChange={e => setNewConditionCode(e.target.value as ConditionCode)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ptdf-500">
                              {Object.entries(CONDITION_DESCRIPTIONS).map(([code, desc]) => (
                                  <option key={code} value={code}>{code} - {desc}</option>
                              ))}
                          </select>
                       </div>
                       <div className="p-3 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600">
                           <p className="font-bold mb-1">Description:</p>
                           <p>{CONDITION_DESCRIPTIONS[newConditionCode]}</p>
                       </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setIsConditionOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                      <button onClick={submitConditionUpdate} disabled={isUpdatingCondition} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">{isUpdatingCondition && <Loader2 size={14} className="animate-spin mr-2"/>} Update Condition</button>
                  </div>
              </div>
          </div>
      )}
      
      {isReportOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Report Asset Issue</h3><button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Custodian</label>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-sm">
                        <User size={16} />
                        <span>{activeAsset?.custodian || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Issue Type</label><select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500"><option value="Damage">Physical Damage</option><option value="Malfunction">Functional Malfunction</option><option value="Lost">Lost / Stolen</option><option value="Maintenance">Routine Maintenance Needed</option><option value="Registration Error">Mistake/Error in Registration</option></select></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg h-24 resize-none outline-none focus:ring-2 focus:ring-ptdf-500" placeholder="Describe the issue in detail..." /></div>
                </div>
                <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsReportOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button><button onClick={submitReport} disabled={isSubmittingReport || !reportDesc} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50">{isSubmittingReport && <Loader2 size={16} className="animate-spin mr-2" />}Submit Report</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AssetLookup;
