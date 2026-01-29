"use client";

import React, { useState, useRef } from 'react';
import { CATEGORIES, LOCATIONS, MOCK_USERS, LOCATION_BRANCHES, LOCATION_CODES, DEPARTMENT_CODES, SUB_CATEGORIES } from '../constants';
import { Asset, ConditionCode, User } from '../types';
import { createAsset } from '../app/actions/assets';
import { CheckCircle, ChevronRight, Save, UploadCloud, FileSpreadsheet, Download, AlertCircle, Table, Printer, Plus, ArrowLeft, QrCode } from 'lucide-react';

const steps = ['Acquisition Details', 'Physical Details', 'Custodian & Financial'];

interface BulkAssetRow {
  rowId: number;
  name: string;
  category: string;
  subCategory?: string; // Asset Type
  cost: number;
  date: string; // Acquisition Date
  registrationDate: string;
  vendor: string;
  invoice: string;
  model: string;
  life: number;
  location: string;
  subLocation?: string;
  condition: string;
  custodian: string;
  assignedUser?: string;
  salvageValue: number;
  depreciationMethod: string;
  previousId?: string;
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
  currentUser: User;
}

const AssetForm: React.FC<AssetFormProps> = ({ onBack, currentUser }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single Entry State
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAsset, setRegisteredAsset] = useState<RegisteredAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showQrCode, setShowQrCode] = useState(false);

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
    subLocation: '',
    condition: 'New',
    custodian: '',
    assignmentType: 'General Purpose',
    assignedUser: '',
    depreciationMethod: 'Straight-Line',
    salvageValue: '',
    registrationDate: new Date().toISOString().split('T')[0],
    subCategory: ''
  });

  // Bulk Upload State
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<BulkAssetRow[]>([]);
  const [importedAssets, setImportedAssets] = useState<Asset[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Validation Logic ---
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (step === 0) {
      if (!formData.name.trim()) newErrors.name = "Asset Name is required";
      if (!formData.category) newErrors.category = "Category is required";
      if (!formData.cost || Number(formData.cost) <= 0) newErrors.cost = "Valid Cost is required";
      if (!formData.date) newErrors.date = "Acquisition Date is required";
      if (!formData.vendor.trim()) newErrors.vendor = "Vendor Name is required";
      if (!formData.invoice.trim()) newErrors.invoice = "Invoice Number is required";
      if (!formData.registrationDate) newErrors.registrationDate = "Registration Date is required";

      if ((formData.category === 'IT Equipment' || formData.category === 'Office Equipment') && !formData.subCategory) {
        newErrors.subCategory = "Asset Type is required";
      }
    }

    if (step === 1) {
      if (!formData.life || Number(formData.life) <= 0) newErrors.life = "Useful Life is required";
      if (!formData.location) newErrors.location = "Location is required";

      const branches = formData.location ? LOCATION_BRANCHES[formData.location] : [];
      if (branches && branches.length > 0 && !formData.subLocation) {
        newErrors.subLocation = "Department/Unit is required";
      }
    }

    if (step === 2) {
      if (!formData.custodian) newErrors.custodian = "Custodian assignment is required";
      if (!formData.salvageValue && formData.salvageValue !== '0') newErrors.salvageValue = "Salvage Value (or 0) is required";
      if (formData.assignmentType === 'Individual' && !formData.assignedUser.trim()) {
        newErrors.assignedUser = "User's Name is required for Individual assignment";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
    } else {
      setErrors({});
    }

    return isValid;
  };

  // --- Single Entry Handlers ---
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const loc = e.target.value;
    const custodian = loc === 'Abuja' ? 'HR' : (loc === 'Kaduna' ? 'Kaduna Partner' : '');
    setFormData({
      ...formData,
      location: loc,
      subLocation: '', // Reset sub-location when location changes
      custodian: custodian
    });
  };

  const generateBarcode = (category: string, name?: string, location?: string, department?: string) => {
    let prefix = 'ITE';
    const cat = category ? category.trim().toLowerCase() : '';
    const assetName = name ? name.trim().toLowerCase() : '';
    const locCode = location && LOCATION_CODES[location] ? LOCATION_CODES[location] : 'GEN';
    const deptCode = department && DEPARTMENT_CODES[department] ? DEPARTMENT_CODES[department] : 'GEN';

    // Smart Category & Name Matching Logic
    if (cat === 'it equipment' || cat.includes('computer')) prefix = 'ITE';
    else if (cat === 'office equipment') prefix = 'OE';
    else if (cat.includes('vehicle') || cat.includes('car') || cat.includes('truck')) prefix = 'VH';
    else if (cat.includes('furniture') || cat.includes('fitting') || cat.includes('chair') || cat.includes('table')) prefix = 'FAF';
    else if (cat.includes('plant') || cat.includes('machinery') || cat.includes('generator')) prefix = 'PMA';
    else if (cat.includes('land') || cat.includes('building')) prefix = 'LND';
    else if (cat.includes('software')) prefix = 'SFW';

    // Name based inference overrides
    else if (
      assetName.includes('photocopier') ||
      assetName.includes('printer') ||
      assetName.includes('dispenser') ||
      assetName.includes('gadget') ||
      assetName.includes('shredder') ||
      assetName.includes('scanner')
    ) {
      prefix = 'OE';
    }
    else if (
      assetName.includes('laptop') ||
      assetName.includes('monitor') ||
      assetName.includes('phone') ||
      assetName.includes('server') ||
      assetName.includes('desktop')
    ) {
      prefix = 'ITE';
    }

    const random = Math.floor(1000 + Math.random() * 9000);
    // Format: ABDC/LOC/DEPT/CAT/ID
    return `ABDC/${locCode}/${deptCode}/${prefix}/${random}`;
  };

  const mapConditionToCode = (condition: string): ConditionCode => {
    switch (condition) {
      case 'New': return 'A1';
      case 'Good': return 'A2';
      case 'Fair': return 'A3';
      case 'Poor': return 'A4';
      default: return 'A2';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    const newId = generateBarcode(formData.category, formData.name, formData.location, formData.subLocation);
    const assetName = formData.name || "New Asset";

    const serverData = {
      productId: newId,
      name: assetName,
      category: formData.category,
      subCategory: formData.subCategory,
      acquisitionCost: parseFloat(formData.cost) || 0,
      acquisitionDate: formData.date || new Date().toISOString().split('T')[0],
      salvageValue: parseFloat(formData.salvageValue) || 0,
      usefulLife: parseInt(formData.life) || 5,
      depreciationMethod: formData.depreciationMethod === 'Reducing Balance' ? 'REDUCING_BALANCE' :
        formData.depreciationMethod === 'Sum of Years' ? 'SUM_OF_YEARS' : 'STRAIGHT_LINE',
      location: formData.location || 'Unassigned',
      subLocation: formData.subLocation,
      condition: mapConditionToCode(formData.condition),
      registrationDate: formData.registrationDate,
      assignmentType: formData.assignmentType,
      assignedUser: formData.assignedUser
    };

    const result = await createAsset(serverData, currentUser.id);

    if (result.success) {
      setRegisteredAsset({
        name: assetName,
        productId: newId,
        barcode: newId
      });
      setCurrentStep(3);
    } else {
      alert("Registration failed: " + result.error);
    }

    setIsSubmitting(false);
  };

  const resetForm = () => {
    setRegisteredAsset(null);
    setImportedAssets([]);
    setParsedData([]);
    setErrors({});
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
      subLocation: '',
      condition: 'New',
      custodian: '',
      assignmentType: 'General Purpose',
      assignedUser: '',
      depreciationMethod: 'Straight-Line',
      salvageValue: '',
      registrationDate: new Date().toISOString().split('T')[0],
      subCategory: ''
    });
    setCurrentStep(0);
    setShowQrCode(false);
  };

  const getQRCodeSVGString = (size = 25) => {
    const modules: string[] = [];
    const isReserved = (r: number, c: number) => {
      if (r < 8 && c < 8) return true;
      if (r < 8 && c >= size - 8) return true;
      if (r >= size - 8 && c < 8) return true;
      if (r >= size - 9 && r <= size - 5 && c >= size - 9 && c <= size - 5) return true;
      const midSize = Math.floor(size / 2);
      if (r >= midSize - 4 && r <= midSize + 4 && c >= midSize - 4 && c <= midSize + 4) return true;
      return false;
    };

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isReserved(r, c)) {
          if (r === 6 || c === 6) {
            if ((r + c) % 2 === 0) modules.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="black" />`);
          } else if (Math.random() > 0.5) {
            modules.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="black" />`);
          }
        }
      }
    }

    const drawFinder = (x: number, y: number) => `
      <g>
        <rect x="${x}" y="${y}" width="7" height="7" fill="black" />
        <rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="white" />
        <rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="black" />
      </g>
    `;

    const mid = size / 2;
    return `
      <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${size}" height="${size}" fill="white" />
        ${modules.join('')}
        ${drawFinder(0, 0)}
        ${drawFinder(size - 7, 0)}
        ${drawFinder(0, size - 7)}
        <g>
          <rect x="${size - 9}" y="${size - 9}" width="5" height="5" fill="black" />
          <rect x="${size - 8}" y="${size - 8}" width="3" height="3" fill="white" />
          <rect x="${size - 7}" y="${size - 7}" width="1" height="1" fill="black" />
        </g>
        <circle cx="${mid}" cy="${mid}" r="4.5" fill="white" stroke="#e2e8f0" stroke-width="0.2" />
        <image href="./abdc-logo-circular.jpg" x="${mid - 3.5}" y="${mid - 3.5}" width="7" height="7" clip-path="circle(50%)" />
      </svg>
    `;
  };

  const renderRealisticQRCode = () => {
    return <div dangerouslySetInnerHTML={{ __html: getQRCodeSVGString() }} className="w-full h-full" />;
  };

  const handlePrintTag = () => {
    const content = document.getElementById('asset-tag-card');
    if (content) {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Asset Tag</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="flex flex-col items-center justify-center h-screen bg-white">');

        printWindow.document.write('<div class="scale-125 transform origin-center">');
        printWindow.document.write(content.outerHTML);
        printWindow.document.write('</div>');

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
      printWindow.document.write('<div class="grid grid-cols-2 gap-8">');

      importedAssets.forEach(asset => {
        const tagContent = `
        <div class="bg-slate-50 border-4 border-slate-900 border-double rounded-xl p-6 text-center break-inside-avoid shadow-sm relative overflow-hidden">
            <div class="flex justify-center mb-2">
                <img src="./abdc-logo-circular.jpg" className="h-10 object-contain" alt="ABDC"/>
            </div>
            <div className="text-left">
                <h3 className="font-bold text-slate-900 text-xl mb-1 tracking-tighter">ABDC ASSET TAG</h3>
            <div class="h-40 bg-white border border-slate-300 my-2 flex items-center justify-center overflow-hidden p-2">
                ${getQRCodeSVGString()}
            </div>
            <p class="font-mono text-xl font-bold tracking-widest text-slate-900 mb-1">${asset.productId}</p>
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

  // Drag and Drop handlers...
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
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
          name: row['Asset Name*'] || row['Asset Name'] || row['Name'] || '',
          category: row['Category*'] || row['Category'] || '',
          subCategory: row['Asset Type (for IT/Office)*'] || row['Asset Type'] || row['Sub-Category'] || '',
          cost: row['Acquisition Cost*'] || row['Acquisition Cost'] || row['Cost'] || 0,
          date: row['Acquisition Date*'] || row['Acquisition Date'] || row['Date'] || '',
          registrationDate: row['Registration Date*'] || row['Registration Date'] || '',
          vendor: row['Vendor Name*'] || row['Vendor Name'] || row['Vendor'] || '',
          invoice: row['Invoice Number*'] || row['Invoice Number'] || row['Invoice'] || '',
          model: row['Model/Serial Number'] || row['Model'] || row['Serial Number'] || '',
          life: row['Useful Life (Years)*'] || row['Useful Life (Years)'] || row['Useful Life'] || row['Life'] || 0,
          location: row['Location*'] || row['Location'] || '',
          subLocation: row['Department/Unit*'] || row['Department/Unit'] || row['Department'] || row['Unit'] || '',
          condition: row['Condition'] || 'New',
          custodian: row['Assigned Custodian*'] || row['Assigned Custodian'] || row['Custodian'] || '',
          assignedUser: row['Assigned User'] || row['User'] || '',
          salvageValue: row['Salvage Value*'] || row['Salvage Value'] || row['Salvage'] || 0,
          depreciationMethod: row['Depreciation Method'] || 'Straight-Line',
          previousId: row['Previous ID'] || row['Existing ID'] || row['Old ID'] || '',
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

  const revalidateRows = (rows: BulkAssetRow[]): BulkAssetRow[] => {
    const nameCounts = new Map<string, number>();
    rows.forEach(r => {
      const n = r.name?.trim().toLowerCase();
      if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
    });

    return rows.map(row => {
      const errors: string[] = [];
      const name = row.name;
      const normalizedName = name?.trim().toLowerCase();
      if (!name) errors.push('Missing Name');
      else if (normalizedName && (nameCounts.get(normalizedName) || 0) > 1) errors.push('Duplicate Name');
      if (!row.category) errors.push('Missing Category');
      if (!row.cost || isNaN(Number(row.cost))) errors.push('Invalid Cost');
      if (!row.date) errors.push('Missing Date');
      if (!row.vendor) errors.push('Missing Vendor');
      if (!row.invoice) errors.push('Missing Invoice');
      if (!row.registrationDate) errors.push('Missing Registration Date');
      if ((row.category === 'IT Equipment' || row.category === 'Office Equipment') && !row.subCategory) {
        errors.push('Missing Asset Type');
      }
      if (!row.life || isNaN(Number(row.life)) || Number(row.life) <= 0) errors.push('Invalid Useful Life');
      if (!row.location) errors.push('Missing Location');
      if (!row.custodian) errors.push('Missing Custodian');
      return { ...row, isValid: errors.length === 0, errors };
    });
  };

  const handlePreviewChange = (rowId: number, field: keyof BulkAssetRow, value: string | number) => {
    const updatedData = parsedData.map(row => row.rowId === rowId ? { ...row, [field]: value } : row);
    const validated = revalidateRows(updatedData);
    setParsedData(validated);
  };

  const handleSuccessEdit = (id: string, field: keyof Asset, value: string) => {
    setImportedAssets(prev => prev.map(asset => asset.id === id ? { ...asset, [field]: value } : asset));
    const assetIndex = [].findIndex(a => a.id === id);
    if (assetIndex > -1) ([][assetIndex] as any)[field] = value;
  };

  const handleBulkImport = () => {
    const validRows = parsedData.filter(d => d.isValid);
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const createdAssets: Asset[] = [];
      validRows.forEach((row, idx) => {
        const newId = generateBarcode(row.category, row.name, row.location, row.subLocation);
        const newAsset: Asset = {
          id: (Date.now() + idx).toString(),
          productId: newId,
          name: row.name,
          category: row.category,
          acquisitionCost: Number(row.cost),
          acquisitionDate: row.date || new Date().toISOString().split('T')[0],
          netBookValue: Number(row.cost),
          location: row.location,
          subLocation: row.subLocation,
          custodian: row.custodian || 'Unassigned',
          assignedUser: row.assignedUser,
          status: 'Active',
          conditionCode: mapConditionToCode(row.condition || 'New'),
          image: `https://picsum.photos/200/200?random=${idx}`,
          usefulLife: Number(row.life),
          salvageValue: Number(row.salvageValue),
          previousId: row.previousId,
          registrationDate: row.registrationDate || new Date().toISOString().split('T')[0],
          subCategory: row.subCategory
        };
        createdAssets.push(newAsset);
      });
      [].push(...createdAssets);
      setIsSubmitting(false);
      setImportedAssets(createdAssets);
      const invalidRows = parsedData.filter(d => !d.isValid);
      setParsedData(invalidRows);
    }, 1500);
  };

  const downloadImportedTags = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX || importedAssets.length === 0) return;
    const data = importedAssets.map(a => ({ "Asset Name": a.name, "Generated Tag ID": a.productId, "Category": a.category, "Location": a.location }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "New Asset Tags");
    XLSX.writeFile(wb, "ABDC_Generated_Tags.xlsx");
  };

  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    // Instruction Rows
    const instructions = [
      { "Asset Name*": "INSTRUCTIONS:", "Category*": "DON'T DELETE THIS ROW", "Acquisition Cost*": "", "Acquisition Date*": "", "Registration Date*": "", "Vendor Name*": "", "Invoice Number*": "", "Useful Life (Years)*": "", "Location*": "", "Department/Unit*": "" },
      { "Asset Name*": "1. Fields with * are compulsory.", "Category*": "", "Acquisition Cost*": "", "Acquisition Date*": "", "Registration Date*": "", "Vendor Name*": "", "Invoice Number*": "", "Useful Life (Years)*": "", "Location*": "", "Department/Unit*": "" },
      { "Asset Name*": "2. Avoid duplicate Asset Names.", "Category*": "", "Acquisition Cost*": "", "Acquisition Date*": "", "Registration Date*": "", "Vendor Name*": "", "Invoice Number*": "", "Useful Life (Years)*": "", "Location*": "", "Department/Unit*": "" },
      { "Asset Name*": "3. Date format: YYYY-MM-DD", "Category*": "", "Acquisition Cost*": "", "Acquisition Date*": "", "Registration Date*": "", "Vendor Name*": "", "Invoice Number*": "", "Useful Life (Years)*": "", "Location*": "", "Department/Unit*": "" },
      { "Asset Name*": "4. Valid Locations: Abuja, Kaduna", "Category*": "", "Acquisition Cost*": "", "Acquisition Date*": "", "Registration Date*": "", "Vendor Name*": "", "Invoice Number*": "", "Useful Life (Years)*": "", "Location*": "", "Department/Unit*": "" },
      {}, // Empty spacer
    ];

    const dataRows = [{
      "Asset Name*": "HP EliteBook",
      "Category*": "IT Equipment",
      "Asset Type (for IT/Office)*": "Laptops",
      "Acquisition Cost*": 850000,
      "Acquisition Date*": "2023-01-15",
      "Registration Date*": "2023-01-16",
      "Vendor Name*": "TechSupply Nigeria Ltd",
      "Invoice Number*": "INV-2023-001",
      "Model/Serial Number": "SN123456789",
      "Useful Life (Years)*": 5,
      "Location*": "Abuja",
      "Department/Unit*": "Tax",
      "Condition": "New",
      "Assigned Custodian*": "HR",
      "Assigned User": "Individual", // or General Purpose
      "Salvage Value*": 50000,
      "Depreciation Method": "Straight-Line",
      "Previous ID": ""
    }];

    const combinedData = [...instructions, ...dataRows];
    const ws = XLSX.utils.json_to_sheet(combinedData);

    // Set widths
    const widths = [
      { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
    ];
    ws['!cols'] = widths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "ABDC_Asset_Upload_Template.xlsx");
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {onBack && (
        <button onClick={onBack} className="flex items-center text-sm text-slate-500 hover:text-abdc-600 mb-6 transition-colors group">
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Register New Asset</h1>
        <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-medium">
          <button onClick={() => { setMode('single'); resetForm(); }} className={`px-4 py-1.5 rounded-md transition-all ${mode === 'single' ? 'bg-white text-abdc-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Single Entry</button>
          <button onClick={() => { setMode('bulk'); resetForm(); }} className={`px-4 py-1.5 rounded-md transition-all ${mode === 'bulk' ? 'bg-white text-abdc-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulk Upload</button>
        </div>
      </div>

      {mode === 'single' ? (
        <>
          {currentStep < 3 && (
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
                {steps.map((step, index) => (
                  <div key={step} className="flex flex-col items-center bg-slate-50 px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors ${index <= currentStep ? 'bg-abdc-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {index < currentStep ? <CheckCircle size={16} /> : index + 1}
                    </div>
                    <span className={`text-xs font-medium ${index === currentStep ? 'text-abdc-600' : 'text-slate-500'}`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
            {currentStep === 3 && registeredAsset ? (
              <div className="flex flex-col items-center justify-center py-6 animate-fadeIn">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
                  <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
                <p className="text-slate-500 mb-8 text-center max-w-md">The asset has been added to the register and assigned a unique ID.</p>

                {/* Tag Preview Card */}
                <div id="asset-tag-card" className="bg-slate-50 border-4 border-slate-800 border-double rounded-xl p-6 w-full max-w-sm mb-8 relative">
                  <div className="absolute top-0 right-0 p-2 text-slate-400 print-hidden flex gap-2">
                    <button onClick={() => setShowQrCode(!showQrCode)} title="Toggle QR/Barcode">
                      {showQrCode ? <FileSpreadsheet size={20} className="hover:text-slate-600" /> : <QrCode size={20} className="hover:text-slate-600" />}
                    </button>
                    <button onClick={handlePrintTag} title="Print Tag">
                      <Printer size={20} className="hover:text-slate-600 cursor-pointer" />
                    </button>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <img src="./abdc-logo-circular.jpg" className="h-12 object-contain" alt="ABDC Logo" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-xl mb-1 tracking-tight">ABDC ASSET TAG</h3>

                    <div className="h-48 bg-white border border-slate-300 my-4 flex items-center justify-center overflow-hidden px-4 rounded-sm">
                      {showQrCode ? (
                        <div className="w-40 h-40 p-1">
                          {renderRealisticQRCode()}
                        </div>
                      ) : (
                        <div className="flex items-end h-16 space-x-[3px] w-full justify-center opacity-90">
                          {[...Array(40)].map((_, i) => <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '2px' : '4px', height: `${40 + Math.random() * 60}%` }}></div>)}
                        </div>
                      )}
                    </div>

                    <p className="font-mono text-xl font-bold tracking-widest text-slate-900 break-words">{registeredAsset.productId}</p>
                    <p className="text-xs text-slate-500 mt-2 font-medium">{registeredAsset.name}</p>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase">Property of Abdulkadeer and Co. (ABDC)</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={handlePrintTag} className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                    <Printer size={18} className="mr-2" /> Print Tag
                  </button>
                  <button onClick={resetForm} className="flex items-center px-6 py-3 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 transition-colors shadow-lg shadow-abdc-200">
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.name ? 'border-red-500' : 'border-slate-300'}`} placeholder="e.g. HP EliteBook" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                        <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.category ? 'border-red-500' : 'border-slate-300'}`}>
                          <option value="">Select Category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                      </div>

                      {(formData.category === 'IT Equipment' || formData.category === 'Office Equipment') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type <span className="text-red-500">*</span></label>
                          <select
                            value={formData.subCategory}
                            onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                            className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.subCategory ? 'border-red-500' : 'border-slate-300'}`}
                          >
                            <option value="">Select Asset Type</option>
                            {SUB_CATEGORIES[formData.category].map(sc => (
                              <option key={sc} value={sc}>{sc}</option>
                            ))}
                          </select>
                          {errors.subCategory && <p className="text-red-500 text-xs mt-1">{errors.subCategory}</p>}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Cost (₦) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.cost ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00" />
                        {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Date <span className="text-red-500">*</span></label>
                        <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.date ? 'border-red-500' : 'border-slate-300'} [color-scheme:light]`} />
                        {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Registration Date <span className="text-red-500">*</span></label>
                        <input type="date" value={formData.registrationDate} onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.registrationDate ? 'border-red-500' : 'border-slate-300'} [color-scheme:light]`} />
                        {errors.registrationDate && <p className="text-red-500 text-xs mt-1">{errors.registrationDate}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.vendor ? 'border-red-500' : 'border-slate-300'}`} placeholder="Supplier Name" />
                        {errors.vendor && <p className="text-red-500 text-xs mt-1">{errors.vendor}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.invoice} onChange={(e) => setFormData({ ...formData, invoice: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.invoice ? 'border-red-500' : 'border-slate-300'}`} placeholder="INV-####" />
                        {errors.invoice && <p className="text-red-500 text-xs mt-1">{errors.invoice}</p>}
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
                        <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none" placeholder="S/N" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Useful Life (Years) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.life} onChange={(e) => setFormData({ ...formData, life: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.life ? 'border-red-500' : 'border-slate-300'}`} placeholder="e.g. 5" />
                        {errors.life && <p className="text-red-500 text-xs mt-1">{errors.life}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Location <span className="text-red-500">*</span></label>
                        <select value={formData.location} onChange={handleLocationChange} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.location ? 'border-red-500' : 'border-slate-300'}`}>
                          <option value="">Select Location</option>
                          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                      </div>

                      {formData.location && LOCATION_BRANCHES[formData.location] && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Department / Unit <span className="text-red-500">*</span></label>
                          <select value={formData.subLocation} onChange={(e) => setFormData({ ...formData, subLocation: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.subLocation ? 'border-red-500' : 'border-slate-300'}`}>
                            <option value="">Select Department</option>
                            {LOCATION_BRANCHES[formData.location].map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          {errors.subLocation && <p className="text-red-500 text-xs mt-1">{errors.subLocation}</p>}
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                        <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none">
                          <option value="New">New</option>
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Poor">Poor</option>
                        </select>
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
                        <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium cursor-not-allowed">
                          {formData.custodian || "Select a location (Abuja/Kaduna) in the previous 'Physical Specifications' section..."}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assigned User <span className="text-red-500">*</span></label>
                        <select
                          value={formData.assignmentType}
                          onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none"
                        >
                          <option value="General Purpose">General Purpose</option>
                          <option value="Individual">Individual</option>
                        </select>
                      </div>

                      {formData.assignmentType === 'Individual' && (
                        <div className="animate-slideIn">
                          <label className="block text-sm font-medium text-slate-700 mb-1">User's Name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={formData.assignedUser}
                            onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                            placeholder="Enter the individual's full name"
                            className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none ${errors.assignedUser ? 'border-red-500' : 'border-slate-300'}`}
                          />
                          {errors.assignedUser && <p className="text-red-500 text-xs mt-1">{errors.assignedUser}</p>}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Method</label>
                        <select value={formData.depreciationMethod} onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none">
                          <option value="Straight-Line">Straight-Line</option>
                          <option value="Reducing Balance">Reducing Balance</option>
                          <option value="Sum of Years">Sum of Years</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Salvage Value (₦) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.salvageValue} onChange={(e) => setFormData({ ...formData, salvageValue: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-abdc-500 ${errors.salvageValue ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00" />
                        {errors.salvageValue && <p className="text-red-500 text-xs mt-1">{errors.salvageValue}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button type="button" onClick={handleBack} disabled={currentStep === 0} className={`px-6 py-2 rounded-lg text-sm font-medium ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}>Back</button>
                  {currentStep < steps.length - 1 ? (
                    <button type="button" onClick={handleNext} className="flex items-center px-6 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 transition-colors">Next Step <ChevronRight size={16} className="ml-2" /></button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="flex items-center px-8 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 transition-colors shadow-lg shadow-abdc-200">{isSubmitting ? 'Processing...' : (<>Save & Generate ID <Save size={16} className="ml-2" /></>)}</button>
                  )}
                </div>
              </form>
            )}
          </div>
        </>
      ) : (
        /* Bulk Upload Mode */
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 animate-fadeIn">
          {importedAssets.length > 0 ? (
            <div className="animate-fadeIn">
              <div className="flex flex-col items-center justify-center text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                  <CheckCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Bulk Import Successful</h2>
                <p className="text-slate-500 text-sm max-w-md">
                  {importedAssets.length} assets have been successfully registered. Tags have been automatically generated.
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center"><Table size={16} className="mr-2" /> Generated Tag List</h3>
                  <div className="flex gap-2">
                    <button onClick={handlePrintAllTags} className="text-xs text-abdc-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-abdc-200 rounded"><Printer size={14} className="mr-1" /> Print All Tags</button>
                    <button onClick={downloadImportedTags} className="text-xs text-abdc-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-abdc-200 rounded"><Download size={14} className="mr-1" /> Export List</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                      <tr><th className="p-3 font-semibold border-b">Asset Name</th><th className="p-3 font-semibold border-b">Previous ID</th><th className="p-3 font-semibold border-b">Generated Tag / ID</th><th className="p-3 font-semibold border-b">Category</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importedAssets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-slate-50 group">
                          <td className="p-3"><input type="text" value={asset.name} onChange={(e) => handleSuccessEdit(asset.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-800 font-medium transition-colors" /></td>
                          <td className="p-3 font-mono text-slate-500 text-xs">{asset.previousId || '-'}</td>
                          <td className="p-3"><div className="flex items-center gap-3"><div className="h-8 w-24 bg-white border border-slate-200 flex items-center justify-center px-1"><div className="flex items-end h-5 space-x-[1px] w-full justify-center opacity-80">{[...Array(25)].map((_, i) => <div key={i} className="bg-slate-900" style={{ width: Math.random() > 0.5 ? '1px' : '2px', height: `${30 + Math.random() * 70}%` }}></div>)}</div></div><span className="font-mono text-abdc-700 font-bold">{asset.productId}</span></div></td>
                          <td className="p-3 text-slate-500 text-xs"><select value={asset.category} onChange={(e) => handleSuccessEdit(asset.id, 'category', e.target.value)} className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 w-full">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-3"><button onClick={resetForm} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium">Upload Another File</button><button onClick={() => { if (onBack) onBack(); }} className="px-6 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 font-medium shadow-md">Return to Dashboard</button></div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center mb-8"><div className="text-center max-w-lg"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-abdc-600"><FileSpreadsheet size={32} /></div><h2 className="text-xl font-bold text-slate-800 mb-2">Upload Asset Data File</h2><p className="text-slate-500 text-sm mb-6">Support for Excel (.xlsx, .xls) and CSV. Ensure your file matches the template structure.</p><button onClick={downloadTemplate} className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors mb-6"><Download size={16} className="mr-2" /> Download Template</button></div><div className={`w-full max-w-2xl h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${dragActive ? 'border-abdc-500 bg-abdc-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}><UploadCloud size={40} className={`mb-3 ${dragActive ? 'text-abdc-600' : 'text-slate-400'}`} /><p className="text-sm font-medium text-slate-700">Drag & Drop your file here</p><p className="text-xs text-slate-400 mt-1">or click to browse</p><input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} /></div></div>
              {isProcessingFile && <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abdc-600"></div><span className="ml-3 text-slate-600 font-medium">Processing file...</span></div>}
              {parsedData.length > 0 && (
                <div className="animate-slideIn">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">Preview Data ({parsedData.length} records)</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 italic mr-2">Click on cells to edit and fix errors.</span>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium">{parsedData.filter(d => d.isValid).length} Valid</span>
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium">{parsedData.filter(d => !d.isValid).length} Invalid</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 mb-6">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 font-semibold border-b">Status</th>
                          <th className="p-3 font-semibold border-b">Asset Name</th>
                          <th className="p-3 font-semibold border-b">Category</th>
                          <th className="p-3 font-semibold border-b">Asset Type</th>
                          <th className="p-3 font-semibold border-b">Acq. Date</th>
                          <th className="p-3 font-semibold border-b">Reg. Date</th>
                          <th className="p-3 font-semibold border-b">Cost</th>
                          <th className="p-3 font-semibold border-b">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.map((row) => (
                          <tr key={row.rowId} className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}>
                            <td className="p-3">{row.isValid ? <CheckCircle size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}</td>
                            <td className="p-3">
                              <input type="text" value={row.name} onChange={(e) => handlePreviewChange(row.rowId, 'name', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 font-medium text-slate-800 transition-colors" />
                            </td>
                            <td className="p-3">
                              <select value={row.category} onChange={(e) => handlePreviewChange(row.rowId, 'category', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-600">
                                <option value="">Select...</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="p-3">
                              <input type="text" value={row.subCategory} onChange={(e) => handlePreviewChange(row.rowId, 'subCategory', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-600" />
                            </td>
                            <td className="p-3">
                              <input type="date" value={row.date} onChange={(e) => handlePreviewChange(row.rowId, 'date', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-600 [color-scheme:light]" />
                            </td>
                            <td className="p-3">
                              <input type="date" value={row.registrationDate} onChange={(e) => handlePreviewChange(row.rowId, 'registrationDate', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-600 [color-scheme:light]" />
                            </td>
                            <td className="p-3">
                              <input type="number" value={row.cost} onChange={(e) => handlePreviewChange(row.rowId, 'cost', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-abdc-500 focus:bg-white focus:outline-none py-1 text-slate-600" />
                            </td>
                            <td className="p-3 text-red-600 text-xs font-semibold">{row.errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-4">
                    <button onClick={() => setParsedData([])} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Clear</button>
                    <button onClick={handleBulkImport} disabled={isSubmitting || parsedData.filter(d => d.isValid).length === 0} className="px-6 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 transition-colors shadow-lg shadow-abdc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
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