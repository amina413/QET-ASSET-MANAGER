
import React, { useState, useRef } from 'react';
import { CATEGORIES, LOCATIONS, MOCK_USERS } from '../constants';
import { CheckCircle, ChevronRight, Save, UploadCloud, FileSpreadsheet, Download, AlertCircle, Check, X, FileText, Printer, Plus } from 'lucide-react';

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

const AssetForm: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  
  // Single Entry State
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAsset, setRegisteredAsset] = useState<RegisteredAsset | null>(null);

  // Bulk Upload State
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<BulkAssetRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Single Entry Handlers ---
  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const generateBarcode = () => {
    // Simulate unique ID generation
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PTDF-${random}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call and ID generation
    setTimeout(() => {
      const newId = generateBarcode();
      const assetName = (e.target as any)[0]?.value || "New Asset"; // Simplified value retrieval for demo
      
      setRegisteredAsset({
        name: assetName,
        productId: newId,
        barcode: newId // In a real app, this might be a different format
      });
      
      setIsSubmitting(false);
      setCurrentStep(3); // Move to Success View
    }, 1500);
  };

  const resetForm = () => {
    setRegisteredAsset(null);
    setCurrentStep(0);
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

        validateBulkData(jsonData);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Error parsing file. Please ensure it is a valid Excel or CSV file.");
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const validateBulkData = (data: any[]) => {
    const seenNames = new Set<string>();

    const validatedRows: BulkAssetRow[] = data.map((row, index) => {
      const errors: string[] = [];
      const name = row['Asset Name'] || row['Name'] || '';
      const category = row['Category'] || '';
      const cost = row['Acquisition Cost'] || row['Cost'] || 0;
      const date = row['Acquisition Date'] || row['Date'] || '';
      const location = row['Location'] || '';
      const salvageValue = row['Salvage Value'] || row['Salvage'] || 0;
      const depreciationMethod = row['Depreciation Method'] || 'Straight-Line';

      if (!name) {
        errors.push('Missing Name');
      } else {
        const normalizedName = name.trim().toLowerCase();
        if (seenNames.has(normalizedName)) {
          errors.push('Duplicate Name in batch');
        } else {
          seenNames.add(normalizedName);
        }
      }

      if (!category) errors.push('Missing Category');
      if (!cost || isNaN(Number(cost))) errors.push('Invalid Cost');
      if (salvageValue && isNaN(Number(salvageValue))) errors.push('Invalid Salvage Value');
      if (!location) errors.push('Missing Location');

      return {
        rowId: index,
        name,
        category,
        cost,
        date,
        location,
        salvageValue,
        depreciationMethod,
        isValid: errors.length === 0,
        errors
      };
    });

    setParsedData(validatedRows);
  };

  const handleBulkImport = () => {
    const validCount = parsedData.filter(d => d.isValid).length;
    if (validCount === 0) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      alert(`Successfully imported ${validCount} assets to the register.`);
      setParsedData([]);
    }, 2000);
  };

  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    const ws = XLSX.utils.json_to_sheet([
      { 
        "Asset Name": "HP EliteBook", 
        "Category": "IT Equipment", 
        "Acquisition Cost": 850000, 
        "Acquisition Date": "2023-01-15", 
        "Location": "Abuja HQ",
        "Salvage Value": 50000,
        "Depreciation Method": "Straight-Line"
      },
      { 
        "Asset Name": "Office Chair", 
        "Category": "Furniture", 
        "Acquisition Cost": 45000, 
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Register New Asset</h1>
        
        {/* Mode Toggle */}
        <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-medium">
          <button 
            onClick={() => setMode('single')}
            className={`px-4 py-1.5 rounded-md transition-all ${mode === 'single' ? 'bg-white text-ptdf-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Single Entry
          </button>
          <button 
            onClick={() => setMode('bulk')}
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
                  The asset has been added to the register. A unique barcode has been generated for tracking.
                </p>

                <div className="bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl p-6 w-full max-w-sm mb-8 relative">
                  <div className="absolute top-0 right-0 p-2 text-slate-400">
                    <Printer size={20} className="hover:text-slate-600 cursor-pointer" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">PTDF ASSET TAG</h3>
                    <div className="h-16 bg-white border border-slate-300 my-3 flex items-center justify-center overflow-hidden">
                      {/* CSS Barcode Simulation */}
                      <div className="flex items-end h-10 space-x-[2px] opacity-80">
                         {[...Array(30)].map((_, i) => (
                           <div key={i} className="bg-black w-[2px] sm:w-[3px]" style={{height: `${30 + Math.random() * 70}%`}}></div>
                         ))}
                      </div>
                    </div>
                    <p className="font-mono text-xl font-bold tracking-widest text-slate-800">{registeredAsset.productId}</p>
                    <p className="text-xs text-slate-500 mt-1">{registeredAsset.name}</p>
                  </div>
                </div>

                <button 
                  onClick={resetForm}
                  className="flex items-center px-6 py-3 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-lg shadow-ptdf-200"
                >
                  <Plus size={18} className="mr-2" /> Register Another Asset
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {currentStep === 0 && (
                  <div className="space-y-6 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Acquisition Data</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                        <input type="text" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 focus:border-ptdf-500 outline-none" placeholder="e.g. HP EliteBook" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <select className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none">
                          <option value="">Select Category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Cost (₦)</label>
                        <input type="number" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Date</label>
                        <input type="date" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
                        <input type="text" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="Supplier Name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                        <input type="text" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="INV-####" />
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
                       <input type="text" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="S/N" />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Expected Useful Life (Years)</label>
                       <input type="number" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="e.g. 5" />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                       <select className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none">
                         <option value="">Select Location</option>
                         {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                       <select className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none">
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
                       <select className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none">
                         <option value="">Search User...</option>
                         {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department})</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Method</label>
                       <select className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none">
                         <option value="Straight-Line">Straight-Line</option>
                         <option value="Double Declining Balance">Double Declining Balance</option>
                         <option value="Sum of Years">Sum of Years</option>
                         <option value="Units of Production">Units of Production</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Salvage Value (₦)</label>
                       <input type="number" className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none" placeholder="0.00" />
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
                <div className="flex gap-2">
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
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
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
                      <tr key={row.rowId} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                        <td className="p-3">
                          {row.isValid ? (
                            <CheckCircle size={18} className="text-green-500" />
                          ) : (
                            <AlertCircle size={18} className="text-red-500" />
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-800">{row.name || '-'}</td>
                        <td className="p-3 text-slate-600">{row.category || '-'}</td>
                        <td className="p-3 text-slate-600">{row.cost ? `₦${row.cost}` : '-'}</td>
                        <td className="p-3 text-slate-600">{row.depreciationMethod}</td>
                        <td className="p-3 text-slate-600">{row.salvageValue ? `₦${row.salvageValue}` : '-'}</td>
                        <td className="p-3 text-red-600 text-xs">
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
        </div>
      )}
    </div>
  );
};

export default AssetForm;
