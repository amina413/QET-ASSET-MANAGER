
import React, { useState, useRef } from 'react';
import { CATEGORIES, LOCATIONS, MOCK_USERS, MOCK_ASSETS } from '../constants';
import { Asset, ConditionCode } from '../types';
import { CheckCircle, ChevronRight, Save, UploadCloud, FileSpreadsheet, Download, AlertCircle, Check, X, FileText, Printer, Plus, ArrowLeft, Table, Edit2 } from 'lucide-react';

const steps = ['Acquisition Details', 'Physical Details', 'Custodian & Financial'];

interface BulkAssetRow {
  rowId: number;
  name: string;
  category: string;
  cost: number;
  date: string;
  location: string;
  salvageValue: number;
  depreciationMethod: string;
  isValid: boolean;
  errors: string[];
}

interface RegisteredAsset {
  name: string;
  productId: string;
  barcode: string;
}

interface AssetFormProps {
  onBack?: () => void;
}

const AssetForm: React.FC<AssetFormProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  
  // Single Entry State
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAsset, setRegisteredAsset] = useState<RegisteredAsset | null>(null);
  
  // Form Data State (Required to persist data across steps)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    cost: '',
    date: '',
    vendor: '',
    invoice: '',
    model: '',
    life: '',
    location: '',
    condition: 'New',
    custodian: '',
    depreciationMethod: 'Straight-Line',
    salvageValue: ''
  });

  // Bulk Upload State
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<BulkAssetRow[]>([]);
  const [importedAssets, setImportedAssets] = useState<Asset[]>([]); // To show success summary
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Single Entry Handlers ---
  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const generateBarcode = (category: string, name?: string) => {
    let prefix = 'PTDF';
    const cat = category ? category.trim().toLowerCase() : '';
    const assetName = name ? name.trim().toLowerCase() : '';

    // Smart Category & Name Matching Logic
    if (cat.includes('it') || cat.includes('office') || cat.includes('computer')) prefix = 'ITE';
    else if (cat.includes('vehicle') || cat.includes('car') || cat.includes('truck')) prefix = 'VH';
    else if (cat.includes('furniture') || cat.includes('fitting') || cat.includes('chair') || cat.includes('table')) prefix = 'FAF';
    else if (cat.includes('plant') || cat.includes('machinery') || cat.includes('generator')) prefix = 'PMA';
    else if (cat.includes('land') || cat.includes('building')) prefix = 'LND';
    else if (cat.includes('software')) prefix = 'SFW';
    
    // Name based inference overrides or defaults if category is ambiguous
    // Handles specific items like "Photocopier", "Water Dispenser", "Gadgets" as ITE
    else if (
        assetName.includes('photocopier') || 
        assetName.includes('printer') || 
        assetName.includes('dispenser') || 
        assetName.includes('gadget') || 
        assetName.includes('laptop') || 
        assetName.includes('monitor') || 
        assetName.includes('phone') ||
        assetName.includes('scanner') ||
        assetName.includes('projector')
    ) {
        prefix = 'ITE';
    }

    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${random}`;
  };

  const mapConditionToCode = (condition: string): ConditionCode => {
    switch(condition) {
      case 'New': return 'A1';
      case 'Good': return 'A2';
      case 'Fair': return 'A3';
      case 'Poor': return 'A4';
      default: return 'A2';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call and ID generation
    setTimeout(() => {
      const newId = generateBarcode(formData.category, formData.name);
      const assetName = formData.name || "New Asset";
      
      // Store asset in Mock Database (Session Persistence)
      const newAsset: Asset = {
        id: (MOCK_ASSETS.length + 100).toString(),
        productId: newId,
        name: assetName,
        category: formData.category,
        acquisitionCost: parseFloat(formData.cost) || 0,
        acquisitionDate: formData.date || new Date().toISOString().split('T')[0],
        netBookValue: parseFloat(formData.cost) || 0,
        location: formData.location || 'Unassigned',
        custodian: MOCK_USERS.find(u => u.id === formData.custodian)?.name || 'Unassigned',
        status: 'Active',
        conditionCode: mapConditionToCode(formData.condition),
        image: 'https://picsum.photos/200/200'
      };

      MOCK_ASSETS.push(newAsset);

      setRegisteredAsset({
        name: assetName,
        productId: newId,
        barcode: newId
      });
      
      setIsSubmitting(false);
      setCurrentStep(3); // Move to Success View
    }, 1500);
  };

  const resetForm = () => {
    setRegisteredAsset(null);
    setImportedAssets([]);
    setParsedData([]);
    setFormData({
      name: '',
      category: '',
      cost: '',
      date: '',
      vendor: '',
      invoice: '',
      model: '',
      life: '',
      location: '',
      condition: 'New',
      custodian: '',
      depreciationMethod: 'Straight-Line',
      salvageValue: ''
    });
    setCurrentStep(0);
  };

  const handlePrintTag = () => {
    const content = document.getElementById('asset-tag-card');
    if (content) {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Asset Tag</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="flex flex-col items-center justify-center h-screen bg-white">');
        
        // Wrap content to ensure styles apply correctly during print
        printWindow.document.write('<div class="scale-125 transform origin-center">');
        printWindow.document.write(content.outerHTML);
        printWindow.document.write('</div>');

        // Hide the printer icon in the print view if it was cloned
        printWindow.document.write('<style>.print-hidden { display: none !important; } body { -webkit-print-color-adjust: exact; }</style>');
        printWindow.document.write('<script>setTimeout(() => { window.print(); window.close(); }, 800);</script>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
      }
    }
  };

  const handlePrintAllTags = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Asset Tags</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('</head><body class="bg-white p-8">');
      
      printWindow.document.write('<div class="grid grid-cols-2 gap-8">'); // 2 columns layout for multiple tags
      
      importedAssets.forEach(asset => {
        const tagContent = `
        <div class="bg-slate-50 border-4 border-slate-900 border-double rounded-xl p-6 text-center break-inside-avoid shadow-sm">
            <h3 class="font-bold text-slate-900 text-xl mb-1 tracking-tighter">PTDF ASSET TAG</h3>
            <div class="h-16 bg-white border border-slate-300 my-2 flex items-center justify-center overflow-hidden px-2">
                <div class="flex items-end h-12 space-x-[2px] w-full justify-center opacity-100">
                    ${Array.from({length: 40}).map(() => `<div class="bg-black" style="width: ${Math.random() > 0.5 ? '2px' : '4px'}; height: ${40 + Math.random() * 60}%"></div>`).join('')}
                </div>
            </div>
            <p class="font-mono text-2xl font-bold tracking-widest text-slate-900 mb-1">${asset.productId}</p>
            <p class="text-xs text-slate-600 font-semibold truncate px-2">${asset.name}</p>
        </div>
        `;
        printWindow.document.write(tagContent);
      });

      printWindow.document.write('</div>');
      printWindow.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } }</style>');
      printWindow.document.write('<script>setTimeout(() => { window.print(); window.close(); }, 1000);</script>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();
    }
  };

  // --- Bulk Upload Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setIsProcessingFile(true);
    setParsedData([]);
    setImportedAssets([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const XLSX = (window as any).XLSX;
        
        if (!XLSX) {
          alert("Excel parser not loaded. Please refresh the page.");
          setIsProcessingFile(false);
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const initialRows = jsonData.map((row: any, index: number) => ({
          rowId: index,
          name: row['Asset Name'] || row['Name'] || '',
          category: row['Category'] || '',
          cost: row['Acquisition Cost'] || row['Cost'] || 0,
          date: row['Acquisition Date'] || row['Date'] || '',
          location: row['Location'] || '',
          salvageValue: row['Salvage Value'] || row['Salvage'] || 0,
          depreciationMethod: row['Depreciation Method'] || 'Straight-Line',
          isValid: true,
          errors: []
        }));

        const validated = revalidateRows(initialRows);
        setParsedData(validated);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Error parsing file. Please ensure it is a valid Excel or CSV file.");
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Re-validation function that checks all rows for duplicates and errors
  const revalidateRows = (rows: BulkAssetRow[]): BulkAssetRow[] => {
    // Count name occurrences to find duplicates
    const nameCounts = new Map<string, number>();
    rows.forEach(r => {
        const n = r.name?.trim().toLowerCase();
        if(n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
    });

    return rows.map(row => {
      const errors: string[] = [];
      const name = row.name;
      const normalizedName = name?.trim().toLowerCase();

      if (!name) {
        errors.push('Missing Name');
      } else if (normalizedName && (nameCounts.get(normalizedName) || 0) > 1) {
        errors.push('Duplicate Name');
      }

      if (!row.category) errors.push('Missing Category');
      if (!row.cost || isNaN(Number(row.cost))) errors.push('Invalid Cost');
      if (row.salvageValue && isNaN(Number(row.salvageValue))) errors.push('Invalid Salvage Value');
      if (!row.location) errors.push('Missing Location');

      return {
        ...row,
        isValid: errors.length === 0,
        errors
      };
    });
  };

  const handlePreviewChange = (rowId: number, field: keyof BulkAssetRow, value: string | number) => {
    const updatedData = parsedData.map(row => 
        row.rowId === rowId ? { ...row, [field]: value } : row
    );
    const validated = revalidateRows(updatedData);
    setParsedData(validated);
  };

  const handleSuccessEdit = (id: string, field: keyof Asset, value: string) => {
    // Update local state to reflect in UI
    setImportedAssets(prev => prev.map(asset => 
        asset.id === id ? { ...asset, [field]: value } : asset
    ));
    
    // Update the mock database as well
    const assetIndex = MOCK_ASSETS.findIndex(a => a.id === id);
    if (assetIndex > -1) {
        (MOCK_ASSETS[assetIndex] as any)[field] = value;
    }
  };

  const handleBulkImport = () => {
    const validRows = parsedData.filter(d => d.isValid);
    if (validRows.length === 0) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      const createdAssets: Asset[] = [];

      validRows.forEach((row, idx) => {
        // Generate Unique Product ID / Tag with Barcode based on Category Prefix AND Name
        const newId = generateBarcode(row.category, row.name);
        
        // Create Asset Object
        const newAsset: Asset = {
            id: (Date.now() + idx).toString(), // Unique internal ID
            productId: newId,
            name: row.name,
            category: row.category,
            acquisitionCost: Number(row.cost),
            acquisitionDate: row.date || new Date().toISOString().split('T')[0],
            netBookValue: Number(row.cost), // Initial NBV
            location: row.location,
            custodian: 'Unassigned', // Bulk upload default
            status: 'Active',
            conditionCode: 'A1', // Default to New/Perfect
            image: `https://picsum.photos/200/200?random=${idx}`
        };

        createdAssets.push(newAsset);
      });

      // Update Global Asset Register (Simulated DB)
      MOCK_ASSETS.push(...createdAssets);

      setIsSubmitting(false);
      setImportedAssets(createdAssets);
      
      // Remove valid rows from preview, keep invalid ones for fixing
      const invalidRows = parsedData.filter(d => !d.isValid);
      setParsedData(invalidRows);
      
    }, 1500);
  };

  const downloadImportedTags = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX || importedAssets.length === 0) return;

    const data = importedAssets.map(a => ({
        "Asset Name": a.name,
        "Generated Tag ID": a.productId,
        "Category": a.category,
        "Location": a.location
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "New Asset Tags");
    XLSX.writeFile(wb, "PTDF_Generated_Tags.xlsx");
  };

  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    const ws = XLSX.utils.json_to_sheet([
      { 
        "Asset Name": "HP EliteBook", 
        "Category": "IT and Office Equipment", 
        "Acquisition Cost": 850000, 
        "Acquisition Date": "2023-01-15", 
        "Location": "Abuja HQ",
        "Salvage Value": 50000,
        "Depreciation Method": "Straight-Line"
      },
      { 
        "Asset Name": "Photocopier", 
        "Category": "Office Equipment", 
        "Acquisition Cost": 245000, 
        "Acquisition Date": "2023-02-20", 
        "Location": "Lagos Office",
        "Salvage Value": 0,
        "Depreciation Method": "Straight-Line"
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "PTDF_Asset_Upload_Template.xlsx");
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 hover:text-ptdf-600 mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Register New Asset</h1>
        
        {/* Mode Toggle */}
        <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-medium">
          <button 
            onClick={() => { setMode('single'); resetForm(); }}
            className={`px-4 py-1.5 rounded-md transition-all ${mode === 'single' ? 'bg-white text-ptdf-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Single Entry
          </button>
          <button 
            onClick={() => { setMode('bulk'); resetForm(); }}
            className={`px-4 py-1.5 rounded-md transition-all ${mode === 'bulk' ? 'bg-white text-ptdf-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Bulk Upload
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <>
          {/* Progress Stepper */}
          {currentStep < 3 && (
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
                {steps.map((step, index) => (
                  <div key={step} className="flex flex-col items-center bg-slate-50 px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors ${
                      index <= currentStep ? 'bg-ptdf-600 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      {index < currentStep ? <CheckCircle size={16} /> : index + 1}
                    </div>
                    <span className={`text-xs font-medium ${index === currentStep ? 'text-ptdf-600' : 'text-slate-500'}`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Card or Success Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
            
            {/* Success View */}
            {currentStep === 3 && registeredAsset ? (
              <div className="flex flex-col items-center justify-center py-6 animate-fadeIn">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
                  <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
                <p className="text-slate-500 mb-8 text-center max-w-md">
                  The asset has been added to the register and assigned a unique ID.
                </p>

                {/* Barcode / Tag Display */}
                <div id="asset-tag-card" className="bg-slate-50 border-4 border-slate-800 border-double rounded-xl p-6 w-full max-w-sm mb-8 relative">
                  <div className="absolute top-0 right-0 p-2 text-slate-400 print-hidden">
                    <button onClick={handlePrintTag} title="Print Tag">
                      <Printer size={20} className="hover:text-slate-600 cursor-pointer" />
                    </button>
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 text-xl mb-1 tracking-tight">PTDF ASSET TAG</h3>
                    <div className="h-20 bg-white border border-slate-300 my-4 flex items-center justify-center overflow-hidden px-2">
                      {/* CSS Barcode Simulation */}
                      <div className="flex items-end h-14 space-x-[3px] w-full justify-center opacity-90">
                         {[...Array(40)].map((_, i) => (
                           <div key={i} className="bg-black" style={{width: Math.random() > 0.5 ? '2px' : '4px', height: `${40 + Math.random() * 60}%`}}></div>
                         ))}
                      </div>
                    </div>
                    <p className="font-mono text-2xl font-bold tracking-widest text-slate-900">{registeredAsset.productId}</p>
                    <p className="text-xs text-slate-500 mt-2 font-medium">{registeredAsset.name}</p>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase">Property of Petroleum Tech. Dev. Fund</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handlePrintTag}
                    className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Printer size={18} className="mr-2" /> Print Tag
                  </button>

                  <button 
                    onClick={resetForm}
                    className="flex items-center px-6 py-3 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-lg shadow-ptdf-200"
                  >
                    <Plus size={18} className="mr-2" /> Register Another Asset
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {currentStep === 0 && (
                  <div className="space-y-6 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Acquisition Data</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 focus:border-ptdf-500 outline-none" 
                          placeholder="e.g. HP EliteBook" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                        >
                          <option value="">Select Category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Cost (₦)</label>
                        <input 
                          type="number" 
                          value={formData.cost}
                          onChange={(e) => setFormData({...formData, cost: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                          placeholder="0.00" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Date</label>
                        <input 
                          type="date" 
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
                        <input 
                          type="text" 
                          value={formData.vendor}
                          onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                          placeholder="Supplier Name" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                        <input 
                          type="text" 
                          value={formData.invoice}
                          onChange={(e) => setFormData({...formData, invoice: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                          placeholder="INV-####" 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                   <div className="space-y-6 animate-fadeIn">
                   <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Physical Specifications</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Model / Serial Number</label>
                       <input 
                         type="text" 
                         value={formData.model}
                         onChange={(e) => setFormData({...formData, model: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                         placeholder="S/N" 
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Expected Useful Life (Years)</label>
                       <input 
                         type="number" 
                         value={formData.life}
                         onChange={(e) => setFormData({...formData, life: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                         placeholder="e.g. 5" 
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                       <select 
                         value={formData.location}
                         onChange={(e) => setFormData({...formData, location: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                       >
                         <option value="">Select Location</option>
                         {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                       <select 
                         value={formData.condition}
                         onChange={(e) => setFormData({...formData, condition: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                       >
                         <option value="New">New</option>
                         <option value="Good">Good</option>
                         <option value="Fair">Fair</option>
                         <option value="Poor">Poor</option>
                       </select>
                     </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Photo</label>
                        <input type="file" className="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-ptdf-50 file:text-ptdf-700
                          hover:file:bg-ptdf-100
                        "/>
                     </div>
                   </div>
                 </div>
                )}

                {currentStep === 2 && (
                   <div className="space-y-6 animate-fadeIn">
                   <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Assignment & Depreciation</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Custodian</label>
                       <select 
                         value={formData.custodian}
                         onChange={(e) => setFormData({...formData, custodian: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                       >
                         <option value="">Search User...</option>
                         {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department})</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Method</label>
                       <select 
                         value={formData.depreciationMethod}
                         onChange={(e) => setFormData({...formData, depreciationMethod: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none"
                       >
                         <option value="Straight-Line">Straight-Line</option>
                         <option value="Double Declining Balance">Double Declining Balance</option>
                         <option value="Sum of Years">Sum of Years</option>
                         <option value="Units of Production">Units of Production</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Salvage Value (₦)</label>
                       <input 
                         type="number" 
                         value={formData.salvageValue}
                         onChange={(e) => setFormData({...formData, salvageValue: e.target.value})}
                         className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" 
                         placeholder="0.00" 
                       />
                     </div>
                   </div>
                 </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className={`px-6 py-2 rounded-lg text-sm font-medium ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Back
                  </button>
                  
                  {currentStep < steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center px-6 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors"
                    >
                      Next Step <ChevronRight size={16} className="ml-2" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center px-8 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-lg shadow-ptdf-200"
                    >
                      {isSubmitting ? 'Processing...' : (
                        <>Save & Generate Barcode <Save size={16} className="ml-2" /></>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 animate-fadeIn">
          {/* BULK UPLOAD MODE */}
          
          {importedAssets.length > 0 ? (
             <div className="animate-fadeIn">
                <div className="flex flex-col items-center justify-center text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Bulk Import Successful</h2>
                    <p className="text-slate-500 text-sm max-w-md">
                        {importedAssets.length} assets have been successfully registered. Tags have been automatically generated.
                        <br/><span className="text-xs text-ptdf-600 font-medium">You can edit the details below if needed.</span>
                    </p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                    <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center">
                            <Table size={16} className="mr-2"/> Generated Tag List
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={handlePrintAllTags} className="text-xs text-ptdf-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-ptdf-200 rounded">
                                <Printer size={14} className="mr-1"/> Print All Tags
                            </button>
                            <button onClick={downloadImportedTags} className="text-xs text-ptdf-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-ptdf-200 rounded">
                                <Download size={14} className="mr-1"/> Export List
                            </button>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 font-semibold border-b">Asset Name</th>
                                    <th className="p-3 font-semibold border-b">Generated Tag / ID</th>
                                    <th className="p-3 font-semibold border-b">Category</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {importedAssets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-slate-50 group">
                                        <td className="p-3">
                                            <input 
                                                type="text" 
                                                value={asset.name} 
                                                onChange={(e) => handleSuccessEdit(asset.id, 'name', e.target.value)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-ptdf-500 focus:bg-white focus:outline-none py-1 text-slate-800 font-medium transition-colors"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-24 bg-white border border-slate-200 flex items-center justify-center px-1">
                                                    <div className="flex items-end h-5 space-x-[1px] w-full justify-center opacity-80">
                                                        {[...Array(25)].map((_, i) => (
                                                            <div key={i} className="bg-slate-900" style={{width: Math.random() > 0.5 ? '1px' : '2px', height: `${30 + Math.random() * 70}%`}}></div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="font-mono text-ptdf-700 font-bold">{asset.productId}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-slate-500 text-xs">
                                            <select 
                                                value={asset.category}
                                                onChange={(e) => handleSuccessEdit(asset.id, 'category', e.target.value)}
                                                className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-ptdf-500 focus:bg-white focus:outline-none py-1 w-full"
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button 
                        onClick={resetForm} 
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium"
                    >
                        Upload Another File
                    </button>
                    <button 
                        onClick={() => { if(onBack) onBack(); }}
                        className="px-6 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 font-medium shadow-md"
                    >
                        Return to Dashboard
                    </button>
                </div>
             </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="text-center max-w-lg">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-ptdf-600">
                    <FileSpreadsheet size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Upload Asset Data File</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Support for Excel (.xlsx, .xls) and CSV. Ensure your file matches the template structure.
                  </p>
                  
                  <button 
                    onClick={downloadTemplate}
                    className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors mb-6"
                  >
                    <Download size={16} className="mr-2" /> Download Template
                  </button>
                </div>

                {/* Drop Zone */}
                <div 
                  className={`w-full max-w-2xl h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    dragActive ? 'border-ptdf-500 bg-ptdf-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={40} className={`mb-3 ${dragActive ? 'text-ptdf-600' : 'text-slate-400'}`} />
                  <p className="text-sm font-medium text-slate-700">Drag & Drop your file here</p>
                  <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Processing / Preview State */}
              {isProcessingFile && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ptdf-600"></div>
                  <span className="ml-3 text-slate-600 font-medium">Processing file...</span>
                </div>
              )}

              {parsedData.length > 0 && (
                <div className="animate-slideIn">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">Preview Data ({parsedData.length} records)</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 italic mr-2">Click on cells to edit and fix errors.</span>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium">
                            {parsedData.filter(d => d.isValid).length} Valid
                        </span>
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium">
                            {parsedData.filter(d => !d.isValid).length} Invalid
                        </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 mb-6">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 font-semibold border-b">Status</th>
                          <th className="p-3 font-semibold border-b">Asset Name</th>
                          <th className="p-3 font-semibold border-b">Category</th>
                          <th className="p-3 font-semibold border-b">Cost</th>
                          <th className="p-3 font-semibold border-b">Depr. Method</th>
                          <th className="p-3 font-semibold border-b">Salvage Value</th>
                          <th className="p-3 font-semibold border-b">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.map((row) => (
                          <tr key={row.rowId} className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}>
                            <td className="p-3">
                              {row.isValid ? (
                                <CheckCircle size={18} className="text-green-500" />
                              ) : (
                                <AlertCircle size={18} className="text-red-500" />
                              )}
                            </td>
                            <td className="p-3">
                                <input 
                                    type="text" 
                                    value={row.name} 
                                    onChange={(e) => handlePreviewChange(row.rowId, 'name', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-ptdf-500 focus:bg-white focus:outline-none py-1 font-medium text-slate-800 transition-colors"
                                />
                            </td>
                            <td className="p-3">
                                <select 
                                    value={row.category}
                                    onChange={(e) => handlePreviewChange(row.rowId, 'category', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-ptdf-500 focus:bg-white focus:outline-none py-1 text-slate-600"
                                >
                                    <option value="">Select...</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </td>
                            <td className="p-3">
                                <input 
                                    type="number" 
                                    value={row.cost} 
                                    onChange={(e) => handlePreviewChange(row.rowId, 'cost', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-ptdf-500 focus:bg-white focus:outline-none py-1 text-slate-600"
                                />
                            </td>
                            <td className="p-3 text-slate-600">{row.depreciationMethod}</td>
                            <td className="p-3 text-slate-600">{row.salvageValue ? `₦${row.salvageValue}` : '-'}</td>
                            <td className="p-3 text-red-600 text-xs font-semibold">
                              {row.errors.join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-4">
                    <button 
                      onClick={() => setParsedData([])}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleBulkImport}
                      disabled={isSubmitting || parsedData.filter(d => d.isValid).length === 0}
                      className="px-6 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-lg shadow-ptdf-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isSubmitting ? 'Importing...' : 'Import Valid Assets'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetForm;
