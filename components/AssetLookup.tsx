
import React, { useState, useRef, useEffect } from 'react';
import { Scan, Search, MapPin, User, Calendar, AlertTriangle, ArrowRightLeft, FileText, Camera, X, Loader2, Image as ImageIcon, ChevronRight, ScanLine, Calculator, RefreshCw, Table, Printer, History, Briefcase, Activity, Filter, CheckCircle2, BoxSelect, TrendingUp, Truck, ArrowLeft } from 'lucide-react';
import { MOCK_ASSETS, MOCK_ASSET_HISTORY, CONDITION_DESCRIPTIONS, LOCATIONS, MOCK_USERS } from '../constants';
import { Asset, ConditionCode } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AssetLookupProps {
  initialSearchTerm?: string;
  managementMode?: boolean;
  onBack?: () => void;
}

const AssetLookup: React.FC<AssetLookupProps> = ({ initialSearchTerm = '', managementMode = false, onBack }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
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

  // Transfer Asset State (Wizard & Modal)
  const [isTransferWizardOpen, setIsTransferWizardOpen] = useState(false);
  const [transferWizardStep, setTransferWizardStep] = useState<1 | 2>(1);
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferWizardResults, setTransferWizardResults] = useState<Asset[]>([]);
  
  const [isTransferOpen, setIsTransferOpen] = useState(false); // Used for direct asset transfer
  const [transferAssetTarget, setTransferAssetTarget] = useState<Asset | null>(null); 
  const [transferLocation, setTransferLocation] = useState('');
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

  // Trigger search on mount if initial term is present
  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Initialize calculator when asset is selected
  useEffect(() => {
    if (activeAsset) {
      setCalcCost(activeAsset.acquisitionCost);
      setCalcSalvage(0); // Default assumption as data is missing in mock
      setCalcLife(5); // Default assumption
      setCalcDate(activeAsset.acquisitionDate);
      if (activeAsset.conditionCode) {
        setNewConditionCode(activeAsset.conditionCode);
      }
    }
  }, [activeAsset]);

  // Helper to get color for Condition Code
  const getConditionColor = (code?: ConditionCode) => {
    if (!code) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (['A1', 'A2'].includes(code)) return 'bg-green-100 text-green-700 border-green-200'; // Good
    if (['A3', 'A4'].includes(code)) return 'bg-amber-100 text-amber-800 border-amber-200'; // Fair/Poor
    if (['F1', 'F2', 'F3'].includes(code)) return 'bg-red-100 text-red-700 border-red-200'; // Damaged
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const calculateDepreciation = () => {
    if (!calcCost || !calcDate) return 0;
    
    const acquisition = new Date(calcDate);
    const today = new Date();
    
    // Prevent future dates from causing calculation errors
    if (acquisition > today) return calcCost;

    const diffTime = today.getTime() - acquisition.getTime();
    const yearsElapsed = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    if (calcLife <= 0) return calcCost;

    // Straight Line Depreciation: (Cost - Salvage) / Life * YearsElapsed
    const depreciableAmount = calcCost - calcSalvage;
    const annualDepreciation = depreciableAmount / calcLife;
    const totalDepreciation = annualDepreciation * yearsElapsed;
    
    const currentValue = calcCost - totalDepreciation;
    return Math.max(calcSalvage, currentValue); // Value cannot go below salvage
  };

  const generateDepreciationSchedule = () => {
    const schedule = [];
    if (!calcDate) return [];

    const depreciableAmount = calcCost - calcSalvage;
    const annualDepreciation = depreciableAmount / calcLife;
    const startYear = new Date(calcDate).getFullYear();
    let currentBookValue = calcCost;
    let accumulatedDepreciation = 0;

    for (let i = 0; i <= calcLife; i++) {
       const year = startYear + i;
       let expense = 0;
       
       if (i > 0) {
         expense = i === calcLife ? (currentBookValue - calcSalvage) : annualDepreciation;
         if (currentBookValue - expense < calcSalvage) {
            expense = currentBookValue - calcSalvage;
         }
       }

       accumulatedDepreciation += expense;
       currentBookValue -= expense;

       if (i > 0) {
          schedule.push({
            year,
            opening: currentBookValue + expense,
            expense,
            accumulated: accumulatedDepreciation,
            closing: currentBookValue
          });
       }
    }
    return schedule;
  };

  const submitReport = () => {
    setIsSubmittingReport(true);
    setTimeout(() => {
        setIsSubmittingReport(false);
        setIsReportOpen(false);
        setReportDesc('');
        alert(`Issue reported successfully for ${activeAsset?.productId}. Maintenance team notified.`);
    }, 1500);
  };

  const openTransferModal = (asset: Asset) => {
    setTransferAssetTarget(asset);
    setIsTransferOpen(true);
  };

  const openTransferWizard = () => {
    setIsTransferWizardOpen(true);
    setTransferWizardStep(1);
    setTransferSearchTerm('');
    setTransferWizardResults([]);
    setTransferAssetTarget(null);
  };

  const handleTransferWizardSearch = (term: string) => {
    setTransferSearchTerm(term);
    if (!term) {
        setTransferWizardResults([]);
        return;
    }
    const results = MOCK_ASSETS.filter(a => 
        a.productId.toLowerCase().includes(term.toLowerCase()) || 
        a.name.toLowerCase().includes(term.toLowerCase())
    );
    setTransferWizardResults(results);
  };

  const selectAssetForWizard = (asset: Asset) => {
    setTransferAssetTarget(asset);
    setTransferWizardStep(2);
  };

  const submitTransfer = () => {
    const target = transferAssetTarget || activeAsset;
    if (!target) return;

    setIsTransferring(true);
    setTimeout(() => {
      setIsTransferring(false);
      setIsTransferOpen(false);
      setIsTransferWizardOpen(false);
      
      // Update local state to reflect change immediately in UI
      if (activeAsset && activeAsset.id === target.id) {
        setActiveAsset({
          ...activeAsset,
          location: transferLocation,
          custodian: transferCustodian
        });
      }

      // Update search results if present
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.map(a => a.id === target.id ? { ...a, location: transferLocation, custodian: transferCustodian } : a));
      }

      alert(`Asset ${target.productId} successfully transferred to ${transferLocation}.`);
      setTransferLocation('');
      setTransferCustodian('');
      setTransferAssetTarget(null);
    }, 1500);
  };

  const submitConditionUpdate = () => {
    setIsUpdatingCondition(true);
    setTimeout(() => {
      setIsUpdatingCondition(false);
      setIsConditionOpen(false);
      if (activeAsset) {
        setActiveAsset({ ...activeAsset, conditionCode: newConditionCode });
      }
      alert(`Condition updated to ${newConditionCode} - ${CONDITION_DESCRIPTIONS[newConditionCode]}.`);
    }, 1000);
  };

  const handlePrintTag = () => {
    if (!activeAsset) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Asset Tag</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('</head><body class="flex flex-col items-center justify-center h-screen bg-white">');
      
      const tagContent = `
        <div class="bg-slate-50 border-4 border-slate-900 border-double rounded-xl p-8 w-96 text-center shadow-none print:shadow-none">
            <h3 class="font-bold text-slate-900 text-2xl mb-2 tracking-tighter">PTDF ASSET TAG</h3>
            <div class="h-24 bg-white border border-slate-300 my-4 flex items-center justify-center overflow-hidden px-4">
                <div class="flex items-end h-16 space-x-[2px] w-full justify-center opacity-100">
                    ${[...Array(50)].map(() => `<div class="bg-black" style="width: ${Math.random() > 0.5 ? '2px' : '4px'}; height: ${40 + Math.random() * 60}%"></div>`).join('')}
                </div>
            </div>
            <p class="font-mono text-3xl font-bold tracking-widest text-slate-900 mb-2">${activeAsset.productId}</p>
            <p class="text-sm text-slate-600 font-semibold truncate px-2">${activeAsset.name}</p>
            <p class="text-[10px] text-slate-400 mt-4 uppercase tracking-widest">Property of Petroleum Technology Development Fund</p>
        </div>
      `;
      
      printWindow.document.write(tagContent);
      printWindow.document.write('<script>setTimeout(() => { window.print(); window.close(); }, 800);</script>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();
    }
  };

  // Text Search Logic
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const results = MOCK_ASSETS.filter(a => {
      const matchesTerm = 
        a.productId.toLowerCase().includes(term.toLowerCase()) ||
        a.name.toLowerCase().includes(term.toLowerCase()) ||
        a.category.toLowerCase().includes(term.toLowerCase()) ||
        a.custodian.toLowerCase().includes(term.toLowerCase());
      
      const matchesCondition = managementMode ? (conditionFilter === 'All' || a.conditionCode === conditionFilter) : true;
      const matchesLocation = locationFilter === 'All' || a.location === locationFilter;
      
      return matchesTerm && matchesCondition && matchesLocation;
    });
    setSearchResults(term ? results : []);
    setActiveAsset(null);
    setIsCalculatorOpen(false);
  };

  const selectAsset = (asset: Asset) => {
    setActiveAsset(asset);
    setSearchResults([]);
    setSearchTerm('');
    setActiveTab('overview');
    setPreviewImage(null);
    setIsCalculatorOpen(false);
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      setActiveAsset(null);
      setSearchResults([]);
      setPreviewImage(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if ('BarcodeDetector' in window) {
           startNativeScanner();
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions or try on a mobile device.");
      setIsCameraOpen(false);
    }
  };

  const startNativeScanner = async () => {
    const BarcodeDetector = (window as any).BarcodeDetector;
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.length === 0) return;
      
      setIsNativeScanning(true);
      const detector = new BarcodeDetector({ formats });
      
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      
      scanIntervalRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
             const barcodes = await detector.detect(videoRef.current);
             if (barcodes.length > 0) {
               const code = barcodes[0].rawValue;
               handleNativeScan(code);
             }
          } catch (e) {
            // Quietly fail
          }
        }
      }, 500); 
    } catch (e) {
      console.error("Native scanner init failed", e);
      setIsNativeScanning(false);
    }
  };

  const handleNativeScan = (code: string) => {
    stopCamera();
    const asset = MOCK_ASSETS.find(a => a.productId === code || a.id === code);
    if (asset) {
      selectAsset(asset);
    } else {
      setSearchTerm(code);
      handleSearch(code);
      alert(`Scanned Code: ${code}. No exact match found in database.`);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setIsNativeScanning(false);
  };

  const captureAndAnalyze = (mode: 'barcode' | 'general') => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Image = dataUrl.split(',')[1];
        
        stopCamera();
        setPreviewImage(dataUrl); 
        setAnalysisMode(mode);
        analyzeImageWithGemini(base64Image, mode);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64String = result.split(',')[1];
        setPreviewImage(result);
        setAnalysisMode('general');
        analyzeImageWithGemini(base64String, 'general');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImageWithGemini = async (base64Image: string, mode: 'barcode' | 'general') => {
    if (!process.env.API_KEY) {
      alert("API Key missing");
      setIsAnalyzing(false);
      setPreviewImage(null);
      return;
    }

    setIsAnalyzing(true);
    setActiveAsset(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const assetInventory = MOCK_ASSETS.map(a => 
        `ID: "${a.id}", ProductCode: "${a.productId}", Name: "${a.name}", Category: "${a.category}"`
      ).join('\n');

      let prompt = '';
      if (mode === 'barcode') {
        prompt = `You are a specialized barcode reader. Analyze this image to find the Asset Product ID. Match found ID against this inventory list:\n${assetInventory}\nReturn ONLY the raw ID (e.g., "1") or "null".`;
      } else {
        prompt = `You are an asset scanner. Identify the asset in this image. Try to match it to this inventory:\n${assetInventory}\nReturn ONLY the raw ID or "null".`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              { text: prompt }
            ]
          }
        ]
      });

      const resultId = response.text.trim().replace(/['"`]/g, '');
      console.log(`Gemini identified Asset ID (${mode} mode):`, resultId);

      if (resultId && resultId !== "null") {
        const found = MOCK_ASSETS.find(a => a.id === resultId);
        if (found) {
          selectAsset(found);
        } else {
          alert(`Analysis returned ID ${resultId}, but it was not found in the local database.`);
          setPreviewImage(null);
        }
      } else {
        alert("Could not confidentially identify the asset.");
        setPreviewImage(null);
      }

    } catch (error) {
      console.error("Gemini analysis failed:", error);
      alert("Visual analysis failed.");
      setPreviewImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const assetHistory = activeAsset 
    ? MOCK_ASSET_HISTORY.filter(h => h.assetId === activeAsset.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
    
  // Filter transfers specifically for the Transfers tab
  const assetTransfers = assetHistory.filter(h => h.type === 'Transfer');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />

      {onBack && (
        <button 
          onClick={() => {
             // If navigating away from active asset or just back to main dashboard
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

      {/* Header */}
      <div className={`bg-white p-6 rounded-xl shadow-sm border mb-6 space-y-4 ${managementMode ? 'border-ptdf-200 bg-ptdf-50' : 'border-slate-100'}`}>
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-ptdf-800">
                {managementMode ? <Briefcase size={28} /> : <ScanLine size={28} />}
                <div>
                    <h2 className="text-2xl font-bold">{managementMode ? 'Asset Management' : 'Asset Lookup'}</h2>
                    <p className="text-sm text-slate-500 opacity-80">{managementMode ? 'Update conditions, transfer assets, and manage lifecycle.' : 'Scan or search to view asset details.'}</p>
                </div>
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={managementMode ? "Search by ID, Name, or Custodian..." : "Search assets..."} 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700"
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="relative w-full md:w-48">
             <select 
               value={locationFilter} 
               onChange={(e) => { setLocationFilter(e.target.value); if(searchTerm) handleSearch(searchTerm); }}
               className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700 appearance-none"
             >
                <option value="All">All Locations</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
             </select>
             <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
          
          {managementMode && (
              <div className="relative w-full md:w-48">
                 <select 
                   value={conditionFilter} 
                   onChange={(e) => { setConditionFilter(e.target.value); if(searchTerm) handleSearch(searchTerm); }}
                   className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700 appearance-none"
                 >
                    <option value="All">All Conditions</option>
                    <option value="A1">A1 - New Perfect</option>
                    <option value="A2">A2 - Used Good</option>
                    <option value="A3">A3 - Used Fair</option>
                    <option value="A4">A4 - Used Poor</option>
                    <option value="F1">F1 - Minor Repairs</option>
                    <option value="F2">F2 - Major Repairs</option>
                    <option value="F3">F3 - Unsalvageable</option>
                 </select>
                 <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
          )}
        </div>

        {!managementMode && (
            <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={startCamera}
                className="flex flex-col items-center justify-center p-4 bg-white border border-ptdf-200 rounded-xl text-ptdf-700 hover:bg-ptdf-50 transition-colors shadow-sm"
            >
                <Camera size={24} className="mb-2" />
                <span className="text-sm font-semibold">Scan Barcode</span>
            </button>
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 bg-white border border-accent-200 rounded-xl text-accent-700 hover:bg-accent-50 transition-colors shadow-sm"
            >
                <ImageIcon size={24} className="mb-2" />
                <span className="text-sm font-semibold">Upload Photo</span>
            </button>
            </div>
        )}
      </div>

      {/* Rest of the component (Camera, Search Results, Details) remains same, just ensuring search logic uses filters */}
      
      {/* Camera View */}
      {isCameraOpen && (
        <div className="relative bg-black rounded-xl overflow-hidden shadow-lg mb-6">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-96 object-cover" />
          <div className="absolute top-4 right-4 z-20">
            <button onClick={stopCamera} className="p-2 bg-black/50 text-white rounded-full"><X size={24} /></button>
          </div>
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-20 px-4">
            <button onClick={() => captureAndAnalyze('barcode')} className="flex-1 py-3 bg-ptdf-600 text-white rounded-full font-bold">Capture Code</button>
            <button onClick={() => captureAndAnalyze('general')} className="flex-1 py-3 bg-white text-slate-900 rounded-full font-bold">Identify Object</button>
          </div>
        </div>
      )}

      {/* Analyzing Loader */}
      {isAnalyzing && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center mb-6">
           <Loader2 size={48} className="animate-spin text-ptdf-600 mx-auto mb-4" />
           <p className="text-slate-500">Looking for asset...</p>
        </div>
      )}

      {/* Search Results */}
      {!activeAsset && searchResults.length > 0 && !isCameraOpen && !isAnalyzing && (
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

      {/* Asset Detail View - (Keeping existing detailed implementation) */}
      {activeAsset && !isCameraOpen && !isAnalyzing && (
        <div className="space-y-4 animate-slideIn">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Asset Details</h3>
            <button onClick={() => { setActiveAsset(null); setPreviewImage(null); }} className="text-sm text-ptdf-600 hover:underline">Back to List</button>
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
                   {activeAsset.conditionCode && (
                     <p className="text-xs text-slate-500 mt-2 font-medium">{CONDITION_DESCRIPTIONS[activeAsset.conditionCode]}</p>
                   )}
                   <div className="mt-4 text-sm text-slate-600 space-y-1">
                       <p><span className="font-semibold">Location:</span> {activeAsset.location}</p>
                       <p><span className="font-semibold">Custodian:</span> {activeAsset.custodian}</p>
                   </div>
                </div>
                <img src={activeAsset.image} alt="Asset" className="w-24 h-24 rounded-lg object-cover bg-slate-200 border border-slate-200" />
             </div>
          </div>

           {/* Tab Navigation */}
           <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('overview')}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Overview
             </button>
             <button 
               onClick={() => setActiveTab('history')}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Full History
             </button>
             <button 
               onClick={() => setActiveTab('transfers')}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'transfers' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Transfer Log
             </button>
             <button 
               onClick={() => setActiveTab('depreciation')}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'depreciation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Depreciation
             </button>
           </div>

           {/* Tabs Content */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[300px]">
             {activeTab === 'overview' && (
               <div className="space-y-6">
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

                 {isCalculatorOpen && (
                   <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 animate-fadeIn">
                      <div className="flex items-center gap-2 mb-3 text-ptdf-700 font-bold border-b border-slate-200 pb-2">
                         <Calculator size={18} />
                         <span>Depreciation Calculator (Straight Line)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Cost (₦)</label>
                            <input type="number" value={calcCost} onChange={e => setCalcCost(Number(e.target.value))} className="w-full p-2 rounded border border-slate-300 text-sm bg-white" />
                         </div>
                         <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Salvage Value (₦)</label>
                            <input type="number" value={calcSalvage} onChange={e => setCalcSalvage(Number(e.target.value))} className="w-full p-2 rounded border border-slate-300 text-sm bg-white" />
                         </div>
                         <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Useful Life (Years)</label>
                            <input type="number" value={calcLife} onChange={e => setCalcLife(Number(e.target.value))} className="w-full p-2 rounded border border-slate-300 text-sm bg-white" />
                         </div>
                         <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Date</label>
                            <input type="date" value={calcDate} onChange={e => setCalcDate(e.target.value)} className="w-full p-2 rounded border border-slate-300 text-sm bg-white" />
                         </div>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded border border-slate-200">
                         <span className="text-sm text-slate-600 font-medium">Estimated Current Book Value:</span>
                         <span className="text-lg font-bold text-ptdf-700">₦{Math.round(calculateDepreciation()).toLocaleString()}</span>
                      </div>
                   </div>
                 )}
                 {!isCalculatorOpen && (
                   <button onClick={() => setIsCalculatorOpen(true)} className="w-full py-2 bg-slate-50 text-ptdf-600 font-medium rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2 text-sm border border-slate-200 transition-colors">
                      <Calculator size={16} /> Open Depreciation Calculator
                   </button>
                 )}
               </div>
             )}

             {activeTab === 'history' && (
               <div className="space-y-0 relative">
                  <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200"></div>
                  {assetHistory.map((event, idx) => (
                    <div key={event.id} className="relative pl-14 py-3 group">
                       <div className={`absolute left-4 top-4 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                         event.type === 'Registration' ? 'bg-green-500' : 
                         event.type === 'Issue' ? 'bg-red-500' :
                         event.type === 'Transfer' ? 'bg-blue-500' :
                         event.type === 'Maintenance' ? 'bg-amber-500' : 'bg-slate-400'
                       }`}></div>
                       
                       <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md hover:border-ptdf-200 transition-all">
                          <div className="flex justify-between items-start mb-1">
                             <h4 className="text-sm font-bold text-slate-800">{event.action}</h4>
                             <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{event.date}</span>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{event.details}</p>
                          <div className="flex items-center text-xs text-slate-400">
                             <User size={12} className="mr-1" />
                             {event.user}
                          </div>
                       </div>
                    </div>
                  ))}
                  {assetHistory.length === 0 && <p className="text-center text-slate-400 py-8">No history available.</p>}
               </div>
             )}

             {activeTab === 'transfers' && (
               <div className="animate-fadeIn">
                 <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
                   <Truck size={16} className="mr-2 text-ptdf-600" />
                   Movement History
                 </h4>
                 {assetTransfers.length > 0 ? (
                   <div className="overflow-x-auto border border-slate-200 rounded-lg">
                     <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                         <tr>
                           <th className="p-3 font-semibold w-32">Date</th>
                           <th className="p-3 font-semibold">From Location</th>
                           <th className="p-3 font-semibold">To Location</th>
                           <th className="p-3 font-semibold">Custodian</th>
                           <th className="p-3 font-semibold">Authorized By</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {assetTransfers.map((event) => (
                           <tr key={event.id} className="hover:bg-slate-50">
                             <td className="p-3 text-slate-600 font-mono text-xs">{event.date.split(' ')[0]}</td>
                             <td className="p-3 text-slate-700">
                                {event.fromLocation ? (
                                  <span className="flex items-center gap-1"><MapPin size={12} className="text-red-400"/> {event.fromLocation}</span>
                                ) : <span className="text-slate-400 italic">--</span>}
                             </td>
                             <td className="p-3 text-slate-800 font-medium">
                                {event.toLocation ? (
                                  <span className="flex items-center gap-1"><MapPin size={12} className="text-green-500"/> {event.toLocation}</span>
                                ) : <span className="text-slate-400 italic">--</span>}
                             </td>
                             <td className="p-3 text-slate-600">
                                {event.toCustodian || <span className="text-slate-400 italic">--</span>}
                             </td>
                             <td className="p-3 text-xs text-slate-500">{event.user}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 ) : (
                   <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                      <ArrowRightLeft size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-slate-500 font-medium">No Transfer Records Found</p>
                      <p className="text-xs text-slate-400">This asset has not been moved since registration.</p>
                   </div>
                 )}
               </div>
             )}

             {activeTab === 'depreciation' && (
               <div className="animate-fadeIn">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center">
                      <TrendingUp size={16} className="mr-2 text-ptdf-600" />
                      Depreciation Schedule (Projected)
                    </h4>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Method: Straight Line</span>
                 </div>
                 
                 <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-60">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                          <tr>
                             <th className="p-3 font-semibold">Year</th>
                             <th className="p-3 font-semibold text-right">Opening Value</th>
                             <th className="p-3 font-semibold text-right">Expense</th>
                             <th className="p-3 font-semibold text-right">Accumulated</th>
                             <th className="p-3 font-semibold text-right">Closing Value</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {generateDepreciationSchedule().map((row, idx) => (
                             <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-800">{row.year}</td>
                                <td className="p-3 text-right text-slate-600">₦{Math.round(row.opening).toLocaleString()}</td>
                                <td className="p-3 text-right text-red-500 font-medium">-₦{Math.round(row.expense).toLocaleString()}</td>
                                <td className="p-3 text-right text-slate-600">₦{Math.round(row.accumulated).toLocaleString()}</td>
                                <td className="p-3 text-right font-bold text-ptdf-700">₦{Math.round(row.closing).toLocaleString()}</td>
                             </tr>
                          ))}
                          {generateDepreciationSchedule().length === 0 && (
                            <tr><td colSpan={5} className="p-4 text-center text-slate-500">Missing acquisition date or cost data.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
               </div>
             )}
           </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
             <button onClick={handlePrintTag} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm">
               <Printer size={20} className="text-slate-400" /> 
               <span>Print Tag</span>
             </button>
             
             {managementMode ? (
                <>
                <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-ptdf-600 text-white rounded-xl font-medium hover:bg-ptdf-700 flex flex-col items-center justify-center gap-2 shadow-md">
                    <ArrowRightLeft size={20} /> 
                    <span>Transfer Asset</span>
                </button>

                <button onClick={() => setIsConditionOpen(true)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm">
                    <Activity size={20} className="text-blue-500" /> 
                    <span>Update Condition</span>
                </button>
                </>
             ) : (
                <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm">
                    <ArrowRightLeft size={20} className="text-slate-400" /> 
                    <span>Transfer</span>
                </button>
             )}
             
             <button onClick={() => setIsReportOpen(true)} className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 flex flex-col items-center justify-center gap-2 shadow-sm">
                <AlertTriangle size={20} className="text-amber-600" /> 
                <span>Report Issue</span>
             </button>
          </div>
        </div>
      )}

      {/* DEFAULT MANAGEMENT DASHBOARD (When in management mode and no asset selected) - (Keeping existing) */}
      {managementMode && !activeAsset && !searchTerm && searchResults.length === 0 && (
          <div className="mt-8">
              {/* Quick Actions Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div 
                    onClick={openTransferWizard} 
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-ptdf-500 transition-all group relative overflow-hidden"
                  >
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10">
                          <ArrowRightLeft size={80} className="text-ptdf-600" />
                      </div>
                      <div className="flex items-center gap-4 relative z-10">
                          <div className="bg-ptdf-50 p-4 rounded-full text-ptdf-600 group-hover:bg-ptdf-600 group-hover:text-white transition-colors">
                              <ArrowRightLeft size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg text-slate-800">Transfer Asset</h3>
                              <p className="text-sm text-slate-500">Move asset to new branch or custodian</p>
                          </div>
                      </div>
                  </div>

                  <div 
                    onClick={() => { /* Could open a generic issue log */ }} 
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-amber-500 transition-all group relative overflow-hidden"
                  >
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10">
                          <AlertTriangle size={80} className="text-amber-600" />
                      </div>
                      <div className="flex items-center gap-4 relative z-10">
                          <div className="bg-amber-50 p-4 rounded-full text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                              <AlertTriangle size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg text-slate-800">Log Incident</h3>
                              <p className="text-sm text-slate-500">Report damage, loss, or maintenance needs</p>
                          </div>
                      </div>
                  </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-4">Assets Needing Attention</h3>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                              <th className="p-4 font-semibold">Asset</th>
                              <th className="p-4 font-semibold">Location</th>
                              <th className="p-4 font-semibold">Current Condition</th>
                              <th className="p-4 font-semibold text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {MOCK_ASSETS.filter(a => ['F1', 'F2', 'F3', 'A3', 'A4'].includes(a.conditionCode || '')).map(asset => (
                              <tr key={asset.id} className="hover:bg-slate-50">
                                  <td className="p-4">
                                      <div className="font-bold text-slate-800">{asset.name}</div>
                                      <div className="text-xs text-slate-500">{asset.productId}</div>
                                  </td>
                                  <td className="p-4 text-slate-600">{asset.location}</td>
                                  <td className="p-4">
                                      <span className={`inline-block px-2 py-1 text-xs font-bold rounded border ${getConditionColor(asset.conditionCode)}`}>
                                          {asset.conditionCode}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      <button onClick={() => openTransferModal(asset)} className="text-slate-600 hover:text-ptdf-600 p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" title="Transfer Asset">
                                          <ArrowRightLeft size={16} />
                                      </button>
                                      <button onClick={() => selectAsset(asset)} className="text-ptdf-600 hover:text-ptdf-800 font-medium text-xs border border-ptdf-200 px-3 py-1.5 rounded-lg hover:bg-ptdf-50 transition-colors">
                                          Manage
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {MOCK_ASSETS.filter(a => ['F1', 'F2', 'F3', 'A3', 'A4'].includes(a.conditionCode || '')).length === 0 && (
                      <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                          <CheckCircle2 size={32} className="text-green-500 mb-2 opacity-50" />
                          <p>All assets are in Good Condition (A1/A2).</p>
                          <p className="text-xs mt-2">Use search to find assets for transfer.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Transfer Wizard, Condition Update, Transfer Modal, Report Modal are kept as is ... */}
      {/* ... (Including rest of the existing modals to ensure nothing breaks) ... */}
      {isTransferWizardOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl animate-blob">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Asset Transfer Wizard</h3>
                    <button onClick={() => setIsTransferWizardOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>

                {/* Wizard Step 1: Search */}
                {transferWizardStep === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Step 1: Find Asset to Transfer</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Search by name or ID..."
                                    value={transferSearchTerm}
                                    onChange={(e) => handleTransferWizardSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                            {transferWizardResults.length > 0 ? (
                                transferWizardResults.map(asset => (
                                    <div 
                                        key={asset.id} 
                                        onClick={() => selectAssetForWizard(asset)}
                                        className="p-3 border-b border-slate-100 last:border-0 hover:bg-white cursor-pointer flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{asset.name}</p>
                                            <p className="text-xs text-slate-500">{asset.productId}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-400" />
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    {transferSearchTerm ? 'No assets found.' : 'Start typing to find an asset.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Wizard Step 2: Details */}
                {transferWizardStep === 2 && transferAssetTarget && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-ptdf-50 p-3 rounded-lg border border-ptdf-100">
                             <div>
                                 <p className="text-xs text-ptdf-600 font-bold uppercase">Selected Asset</p>
                                 <p className="font-bold text-slate-800">{transferAssetTarget.name}</p>
                                 <p className="text-xs text-slate-500">{transferAssetTarget.productId}</p>
                             </div>
                             <button onClick={() => setTransferWizardStep(1)} className="text-xs text-ptdf-600 underline">Change</button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Location</label>
                            <select 
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500" 
                                value={transferLocation} 
                                onChange={e => setTransferLocation(e.target.value)}
                            >
                                <option value="">Select Destination Branch/Location</option>
                                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Custodian</label>
                            <select 
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500" 
                                value={transferCustodian} 
                                onChange={e => setTransferCustodian(e.target.value)}
                            >
                                <option value="">Select Receiving Custodian</option>
                                {MOCK_USERS.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsTransferWizardOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button 
                                onClick={submitTransfer} 
                                disabled={!transferLocation || !transferCustodian || isTransferring} 
                                className="px-4 py-2 bg-ptdf-600 text-white rounded-lg flex items-center disabled:opacity-50 hover:bg-ptdf-700"
                            >
                                {isTransferring && <Loader2 size={16} className="animate-spin mr-2" />} Confirm Transfer
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Legacy/Direct Modals */}
      {isConditionOpen && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl animate-blob">
                 <h3 className="text-lg font-bold text-slate-800 mb-4">Update Asset Condition</h3>
                 <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
                    {(Object.keys(CONDITION_DESCRIPTIONS) as ConditionCode[]).map((code) => (
                      <label key={code} className={`flex items-center p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-all ${newConditionCode === code ? 'border-ptdf-500 bg-ptdf-50 ring-1 ring-ptdf-500' : 'border-slate-200'}`}>
                         <input 
                           type="radio" 
                           name="condition" 
                           className="text-ptdf-600 focus:ring-ptdf-500 mr-3"
                           checked={newConditionCode === code}
                           onChange={() => setNewConditionCode(code)}
                         />
                         <div>
                            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded mr-2 border ${getConditionColor(code)}`}>{code}</span>
                            <span className="text-sm text-slate-600">{CONDITION_DESCRIPTIONS[code]}</span>
                         </div>
                      </label>
                    ))}
                 </div>
                 <div className="flex justify-end gap-3">
                   <button onClick={() => setIsConditionOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                   <button onClick={submitConditionUpdate} className="px-4 py-2 bg-ptdf-600 text-white rounded-lg flex items-center hover:bg-ptdf-700">
                     {isUpdatingCondition && <Loader2 size={16} className="animate-spin mr-2" />} Update Status
                   </button>
                 </div>
              </div>
            </div>
          )}

          {isTransferOpen && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl animate-blob">
                 <h3 className="text-lg font-bold text-slate-800 mb-2">Transfer Asset</h3>
                 <p className="text-sm text-slate-500 mb-6">
                    Moving <span className="font-semibold text-slate-700">{(transferAssetTarget || activeAsset)?.name}</span> ({(transferAssetTarget || activeAsset)?.productId})
                 </p>
                 
                 <div className="space-y-4 mb-6">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                         <p className="text-xs text-slate-400 uppercase font-semibold">Current Location</p>
                         <div className="flex items-center gap-2 mt-1 text-slate-700 font-medium">
                            <MapPin size={16} />
                            {(transferAssetTarget || activeAsset)?.location}
                         </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 -top-3 w-0.5 h-4 bg-slate-200"></div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">New Location</label>
                      <select 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500" 
                        value={transferLocation} 
                        onChange={e => setTransferLocation(e.target.value)}
                      >
                        <option value="">Select Destination Branch/Location</option>
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">New Custodian</label>
                      <select 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500" 
                        value={transferCustodian} 
                        onChange={e => setTransferCustodian(e.target.value)}
                      >
                        <option value="">Select Receiving Custodian</option>
                        {MOCK_USERS.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                 </div>
                 <div className="flex justify-end gap-3">
                   <button onClick={() => setIsTransferOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                   <button onClick={submitTransfer} disabled={!transferLocation || !transferCustodian || isTransferring} className="px-4 py-2 bg-ptdf-600 text-white rounded-lg flex items-center disabled:opacity-50 hover:bg-ptdf-700">
                     {isTransferring && <Loader2 size={16} className="animate-spin mr-2" />} Confirm Transfer
                   </button>
                 </div>
              </div>
            </div>
          )}

          {isReportOpen && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fadeIn p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Report Asset Issue</h3>
                  <button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Issue Type</label>
                    <select 
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500"
                    >
                      <option value="Damage">Physical Damage</option>
                      <option value="Malfunction">Functional Malfunction</option>
                      <option value="Lost">Lost / Stolen</option>
                      <option value="Maintenance">Routine Maintenance Needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea 
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg h-24 resize-none outline-none focus:ring-2 focus:ring-ptdf-500"
                      placeholder="Describe the issue in detail..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    onClick={() => setIsReportOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitReport}
                    disabled={isSubmittingReport || !reportDesc}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50"
                  >
                    {isSubmittingReport && <Loader2 size={16} className="animate-spin mr-2" />}
                    Submit Report
                  </button>
                </div>
              </div>
            </div>
          )}

      {!managementMode && !activeAsset && !isCameraOpen && !isAnalyzing && searchResults.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ScanLine size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-slate-500">
             Asset Lookup
          </p>
          <p className="text-sm">
             Scan a barcode or search by ID/Name/Location to view details.
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetLookup;
