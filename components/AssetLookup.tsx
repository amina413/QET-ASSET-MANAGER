
import React, { useState, useRef, useEffect } from 'react';
import { Scan, Search, MapPin, User, Calendar, AlertTriangle, ArrowRightLeft, FileText, Camera, X, Loader2, Image as ImageIcon, ChevronRight, ScanLine, Calculator, RefreshCw, Table, Printer, History } from 'lucide-react';
import { MOCK_ASSETS, MOCK_ASSET_HISTORY } from '../constants';
import { Asset } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AssetLookupProps {
  initialSearchTerm?: string;
  isReportMode?: boolean;
}

const AssetLookup: React.FC<AssetLookupProps> = ({ initialSearchTerm = '', isReportMode = false }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'depreciation'>('overview');

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
    }
  }, [activeAsset]);

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
         // Simple logic: Full year depreciation for simplicity in this MVP
         expense = i === calcLife ? (currentBookValue - calcSalvage) : annualDepreciation;
         // Adjust if expense creates negative value (rounding issues)
         if (currentBookValue - expense < calcSalvage) {
            expense = currentBookValue - calcSalvage;
         }
       }

       accumulatedDepreciation += expense;
       currentBookValue -= expense;

       // Stop if we've reached the end of life or value is 0/salvage
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

  const handlePrintTag = () => {
    if (!activeAsset) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Asset Tag</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('</head><body class="flex flex-col items-center justify-center h-screen bg-white">');
      
      // Dynamic content for the tag with simulated barcode
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
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    const results = MOCK_ASSETS.filter(a =>
      a.productId.toLowerCase().includes(term.toLowerCase()) ||
      a.name.toLowerCase().includes(term.toLowerCase()) ||
      a.category.toLowerCase().includes(term.toLowerCase()) ||
      a.custodian.toLowerCase().includes(term.toLowerCase())
    );
    setSearchResults(results);
    setActiveAsset(null); // Reset detail view when searching
    setIsCalculatorOpen(false);
  };

  const selectAsset = (asset: Asset) => {
    setActiveAsset(asset);
    setSearchResults([]);
    setSearchTerm('');
    setActiveTab('overview');
    setPreviewImage(null);
    setIsCalculatorOpen(false);
    
    // Auto-open report modal if in report mode
    if (isReportMode) {
      setIsReportOpen(true);
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      setActiveAsset(null);
      setSearchResults([]);
      setPreviewImage(null);
      setIsCalculatorOpen(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Attempt to start native barcode scanning if supported
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
            // Quietly fail for frame errors
          }
        }
      }, 500); // Check every 500ms
    } catch (e) {
      console.error("Native barcode detection failed to initialize", e);
      setIsNativeScanning(false);
    }
  };

  const handleNativeScan = (code: string) => {
    stopCamera();
    // Try to find exact match
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
        setPreviewImage(dataUrl); // Set preview for the analysis screen
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
        setPreviewImage(result); // Set preview for the analysis screen
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
      
      // Context: We provide the current inventory to the model so it can fuzzy match
      const assetInventory = MOCK_ASSETS.map(a => 
        `ID: "${a.id}", ProductCode: "${a.productId}", Name: "${a.name}", Category: "${a.category}"`
      ).join('\n');

      let prompt = '';
      
      if (mode === 'barcode') {
        prompt = `
          You are a specialized barcode and text reader for asset management.
          
          Task: Analyze this image to find the Asset Product ID.
          1. Look specifically for barcodes, QR codes, or text labels containing format like 'PTDF-XXXX'.
          2. Ignore background objects; focus on the label.
          3. Match the found ID against this inventory list:
          
          ${assetInventory}
          
          Output:
          Return ONLY the raw ID (e.g., "1") of the matching asset from the inventory list.
          If you see a code that matches the format but isn't in the list, return "null".
          If no code is found, return "null".
          Do not include any explanation or markdown.
        `;
      } else {
        prompt = `
          You are the visual scanner for the PTDF Asset Management System.
          
          Task: Identify the asset in this image.
          1. Look for visual characteristics (laptop, car, chair).
          2. Also look for any visible text or labels.
          3. Try to match it to the best candidate in this inventory list:
          
          ${assetInventory}
          
          Output:
          Return ONLY the raw ID of the single best matching asset.
          If you cannot find a strong match, return the string "null".
          Do not include markdown formatting or extra text.
        `;
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

      const resultId = response.text.trim().replace(/['"`]/g, ''); // Clean up quotes
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
        alert(mode === 'barcode' 
          ? "Could not read a valid barcode or Product ID from the image. Try moving closer or using 'Identify Object'." 
          : "Could not confidently identify an asset from this image. Please try searching by name or ID.");
        setPreviewImage(null);
      }

    } catch (error) {
      console.error("Gemini analysis failed:", error);
      alert("Visual analysis failed. Please check your connection.");
      setPreviewImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter history for the active asset and sort by date descending
  const assetHistory = activeAsset 
    ? MOCK_ASSET_HISTORY.filter(h => h.assetId === activeAsset.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  // Clean up camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Hidden Elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileUpload}
      />

      {/* Main Search & Action Header */}
      <div className={`bg-white p-6 rounded-xl shadow-sm border mb-6 space-y-4 ${isReportMode ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
        {isReportMode && (
          <div className="flex items-center gap-2 mb-2 text-amber-800">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold">Report Asset Issue</h2>
          </div>
        )}
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={isReportMode ? "Find asset to report (ID, Name)..." : "Search assets by ID, Name, Category..."} 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none text-slate-700 placeholder:text-slate-400"
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

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={startCamera}
            className="flex flex-col items-center justify-center p-4 bg-white border border-ptdf-200 rounded-xl text-ptdf-700 hover:bg-ptdf-50 transition-colors shadow-sm"
          >
            <Camera size={24} className="mb-2" />
            <span className="text-sm font-semibold">{isReportMode ? 'Scan to Report' : 'Scan Barcode'}</span>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-4 bg-white border border-accent-200 rounded-xl text-accent-700 hover:bg-accent-50 transition-colors shadow-sm"
          >
            <ImageIcon size={24} className="mb-2" />
            <span className="text-sm font-semibold">Upload Photo</span>
          </button>
        </div>
        
        {isReportMode && !searchTerm && !activeAsset && (
          <p className="text-sm text-slate-500 text-center italic">
            Scan a barcode or search for an asset to open the report form.
          </p>
        )}
      </div>

      {/* DYNAMIC CONTENT AREA */}

      {/* 1. Camera View */}
      {isCameraOpen && (
        <div className="relative bg-black rounded-xl overflow-hidden shadow-lg mb-6 animate-fadeIn">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-96 object-cover" />
          <div className="absolute top-4 right-4 z-20">
            <button onClick={stopCamera} className="p-2 bg-black/50 text-white rounded-full">
              <X size={24} />
            </button>
          </div>
          
          {/* Scanner Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className={`w-64 h-40 border-2 rounded-lg relative transition-colors ${isNativeScanning ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'border-ptdf-500/70'}`}>
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-ptdf-500 -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-ptdf-500 -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-ptdf-500 -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-ptdf-500 -mb-1 -mr-1"></div>
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/50 animate-pulse"></div>
            </div>
          </div>

          {/* Status Indicator */}
          {isNativeScanning && (
            <div className="absolute top-4 left-4 z-20 bg-black/50 px-3 py-1 rounded-full flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               <span className="text-white text-xs font-medium">Auto-Scanning...</span>
            </div>
          )}
          
          {/* Dedicated Control Buttons */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-20 px-4">
            <button 
              onClick={() => captureAndAnalyze('barcode')}
              className="flex-1 max-w-[160px] py-3 bg-ptdf-600 text-white rounded-full font-bold shadow-lg hover:bg-ptdf-700 flex items-center justify-center"
            >
              <ScanLine size={20} className="mr-2" /> Capture Code
            </button>
            <button 
              onClick={() => captureAndAnalyze('general')}
              className="flex-1 max-w-[160px] py-3 bg-white text-slate-900 rounded-full font-bold shadow-lg hover:bg-slate-100 flex items-center justify-center"
            >
              <Camera size={20} className="mr-2" /> Identify Object
            </button>
          </div>
        </div>
      )}

      {/* 2. Analyzing State */}
      {isAnalyzing && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center mb-6 animate-fadeIn">
          {previewImage && (
             <div className="mb-4 relative w-full h-56 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
               <img src={previewImage} alt="Scanning" className="w-full h-full object-contain" />
               <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
                  <Loader2 size={48} className="animate-spin text-ptdf-600" />
               </div>
             </div>
          )}
          {!previewImage && <Loader2 size={48} className="animate-spin text-ptdf-600 mx-auto mb-4" />}
          <h3 className="text-lg font-bold text-slate-800">
            {analysisMode === 'barcode' ? 'Reading Barcode...' : 'Looking for asset...'}
          </h3>
          <p className="text-slate-500">
            {analysisMode === 'barcode' 
              ? 'Analyzing image to extract Product ID.' 
              : 'Analyzing visual features to match inventory.'}
          </p>
        </div>
      )}

      {/* 3. Search Results List */}
      {!activeAsset && searchResults.length > 0 && !isCameraOpen && !isAnalyzing && (
        <div className="space-y-4 animate-slideIn">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">Search Results ({searchResults.length})</h3>
          {searchResults.map((asset) => (
            <div 
              key={asset.id} 
              onClick={() => selectAsset(asset)}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-ptdf-300 cursor-pointer transition-all"
            >
              <div className="flex items-center space-x-4">
                <img src={asset.image} alt={asset.name} className="w-12 h-12 rounded-lg object-cover bg-slate-200" />
                <div>
                  <h4 className="font-bold text-slate-800">{asset.name}</h4>
                  <p className="text-xs text-slate-500">{asset.productId} • {asset.location}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400" />
            </div>
          ))}
        </div>
      )}

      {/* 4. Asset Detail View */}
      {activeAsset && !isCameraOpen && !isAnalyzing && (
        <div className="space-y-4 animate-slideIn">
          {/* Detail Header */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Asset Details</h3>
            <button onClick={() => { setActiveAsset(null); setPreviewImage(null); }} className="text-sm text-ptdf-600 hover:underline">Back to Search</button>
          </div>

          {/* Asset Header Card */}
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-ptdf-600 relative overflow-hidden">
             <div className="flex justify-between items-start relative z-10">
                <div>
                   <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2 ${
                     activeAsset.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                   }`}>
                     {activeAsset.status}
                   </span>
                   <h2 className="text-xl font-bold text-slate-900">{activeAsset.name}</h2>
                   <p className="text-sm font-mono text-slate-500 mt-1">{activeAsset.productId}</p>
                </div>
                <img src={activeAsset.image} alt="Asset" className="w-16 h-16 rounded-lg object-cover bg-slate-200" />
             </div>
          </div>

          {/* DEPRECIATION CALCULATOR MODAL / VIEW */}
          {isCalculatorOpen ? (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-ptdf-200 animate-fadeIn">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div className="flex items-center text-ptdf-700">
                  <Calculator className="mr-2" size={20} />
                  <h3 className="font-bold text-lg">Depreciation Estimator</h3>
                </div>
                <button onClick={() => setIsCalculatorOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Purchase Date</label>
                  <input 
                    type="date" 
                    value={calcDate}
                    onChange={(e) => setCalcDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Acquisition Cost (₦)</label>
                  <input 
                    type="number" 
                    value={calcCost}
                    onChange={(e) => setCalcCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Salvage Value (₦)</label>
                  <input 
                    type="number" 
                    value={calcSalvage}
                    onChange={(e) => setCalcSalvage(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Useful Life (Years)</label>
                  <input 
                    type="number" 
                    value={calcLife}
                    onChange={(e) => setCalcLife(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-6 text-white text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Estimated Book Value</p>
                <div className="text-3xl font-bold font-mono">
                  ₦{calculateDepreciation().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-2">Based on Straight-Line Method</p>
              </div>

              <button 
                onClick={() => setIsCalculatorOpen(false)}
                className="w-full mt-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Close Calculator
              </button>
            </div>
          ) : (
            <>
              {/* Normal Tabs */}
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  History
                </button>
                <button 
                  onClick={() => setActiveTab('depreciation')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'depreciation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Depreciation
                </button>
              </div>

              {/* Overview Tab Content */}
              {activeTab === 'overview' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fadeIn">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Financial & Location</h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Net Book Value</p>
                      <p className="text-lg font-bold text-slate-800">₦{activeAsset.netBookValue.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Acquisition Cost</p>
                      <p className="text-lg font-bold text-slate-800">₦{activeAsset.acquisitionCost.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <MapPin className="text-ptdf-500 mt-1 mr-3" size={18} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Current Location</p>
                        <p className="text-sm text-slate-500">{activeAsset.location}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <User className="text-ptdf-500 mt-1 mr-3" size={18} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Custodian</p>
                        <p className="text-sm text-slate-500">{activeAsset.custodian}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Calendar className="text-ptdf-500 mt-1 mr-3" size={18} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Acquisition Date</p>
                        <p className="text-sm text-slate-500">{activeAsset.acquisitionDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab Content */}
              {activeTab === 'history' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fadeIn">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Asset Audit Log & History</h3>
                  
                  {assetHistory.length > 0 ? (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pl-6 py-2">
                      {assetHistory.map((event) => (
                        <div key={event.id} className="relative group">
                          {/* Dot Indicator */}
                          <div className={`absolute -left-[31px] h-4 w-4 rounded-full border-2 border-white shadow-sm ring-2 ring-white transition-all ${
                            event.type === 'Audit' ? 'bg-green-500' :
                            event.type === 'Maintenance' ? 'bg-amber-500' :
                            event.type === 'Issue' ? 'bg-red-500' :
                            event.type === 'Registration' ? 'bg-slate-500' : 'bg-blue-500'
                          }`}></div>
                          
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{event.action}</p>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{event.details}</p>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                                <User size={12} /> {event.user}
                              </p>
                            </div>
                            <span className="text-xs font-mono text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded border border-slate-100 self-start mt-2 sm:mt-0">
                              {event.date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <History size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500 font-medium">No detailed history records found.</p>
                      <p className="text-xs text-slate-400">Activities like transfers and audits will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Depreciation Schedule Tab Content */}
              {activeTab === 'depreciation' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fadeIn">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Depreciation Schedule</h3>
                    <button onClick={() => setIsCalculatorOpen(true)} className="text-xs text-ptdf-600 flex items-center hover:underline">
                      <Calculator size={14} className="mr-1" /> Adjust Parameters
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg mb-4 text-xs text-slate-600 flex justify-between">
                     <span><strong>Method:</strong> Straight-Line</span>
                     <span><strong>Useful Life:</strong> {calcLife} Years</span>
                     <span><strong>Salvage:</strong> ₦{calcSalvage.toLocaleString()}</span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="p-3 font-semibold border-b">Year</th>
                          <th className="p-3 font-semibold border-b text-right">Opening</th>
                          <th className="p-3 font-semibold border-b text-right">Expense</th>
                          <th className="p-3 font-semibold border-b text-right">Accumulated</th>
                          <th className="p-3 font-semibold border-b text-right">Closing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {generateDepreciationSchedule().map((row) => (
                          <tr key={row.year} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-700">{row.year}</td>
                            <td className="p-3 text-right text-slate-600">₦{Math.round(row.opening).toLocaleString()}</td>
                            <td className="p-3 text-right text-red-500 font-medium">-₦{Math.round(row.expense).toLocaleString()}</td>
                            <td className="p-3 text-right text-slate-600">₦{Math.round(row.accumulated).toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-slate-800">₦{Math.round(row.closing).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handlePrintTag}
                    className="flex items-center justify-center p-3 bg-ptdf-50 border border-ptdf-200 rounded-xl text-ptdf-700 font-medium hover:bg-ptdf-100 shadow-sm transition-colors"
                  >
                    <Printer size={18} className="mr-2" />
                    Print Asset Tag
                  </button>
                  <button className="flex items-center justify-center p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 shadow-sm transition-colors">
                    <ArrowRightLeft size={18} className="mr-2 text-slate-500" />
                    Initiate Transfer
                  </button>
                </div>
                
                <button 
                  onClick={() => setIsReportOpen(true)}
                  className={`flex items-center justify-center p-3 border rounded-xl font-medium shadow-sm transition-colors ${isReportMode ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`}
                >
                  <AlertTriangle size={18} className={`mr-2 ${isReportMode ? 'text-white' : 'text-amber-600'}`} />
                  {isReportMode ? 'Log Issue Now' : 'Report Condition Issue'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* REPORT ISSUE MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Report Asset Issue</h3>
              <button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              {activeAsset && (
                 <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                    <img src={activeAsset.image} className="w-10 h-10 rounded object-cover" />
                    <div>
                       <p className="text-sm font-bold text-slate-900">{activeAsset.name}</p>
                       <p className="text-xs text-slate-500">{activeAsset.productId}</p>
                    </div>
                 </div>
              )}

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

      {/* Empty State */}
      {!activeAsset && !isCameraOpen && !isAnalyzing && searchResults.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Scan size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-slate-500">
             {isReportMode ? 'Start Report Process' : 'Ready to Search'}
          </p>
          <p className="text-sm">
             {isReportMode ? 'Scan or search for the asset you want to report.' : 'Scan a barcode, upload a photo, or search by text.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetLookup;