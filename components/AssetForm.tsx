"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CATEGORIES, LOCATIONS, MOCK_USERS, LOCATION_BRANCHES, LOCATION_CODES, DEPARTMENT_CODES, SUB_CATEGORIES } from '../constants';
import { Asset, ConditionCode, User } from '../types';
import { createAsset, getNextSerialForPrefix, createAssetsBulk } from '../app/actions/assets';
import { getDepartments, getLocations, getCategories, getAssetTypes, getAssetClasses } from '../app/actions/settings';
import { canRegisterAsset } from '../lib/permissions';
import { CheckCircle, ChevronRight, Save, UploadCloud, FileSpreadsheet, Download, AlertCircle, Table, Printer, Plus, ArrowLeft, QrCode, ImagePlus, X } from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const steps = ['Acquisition Details', 'Physical Details', 'Custodian & Financial'];

const ASSET_CLASS_OPTIONS = ['General Purpose', 'Cluster'] as const;
const CUSTODIAN_BY_ASSET_CLASS: Record<string, string[]> = {
  'General Purpose': ['HR/Admin', 'Manager Training Hub', 'Individual'],
  Cluster: [
    "Chairman's secretary 3.01",
    'MP Advisory 2.04',
    'Dir Shared Services 2.02',
    'MP Audit and Assurance 2.03',
    'Partner Project/Tax 2.01',
    'ED secretary 3.02',
    'ED secretary 3.03',
  ],
};

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
  assetClass?: string;
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
    assetClass: 'General Purpose' as 'General Purpose' | 'Cluster',
    custodian: '',
    assignedUser: '',
    depreciationMethod: 'Straight-Line',
    salvageValue: '',
    registrationDate: new Date().toISOString().split('T')[0],
    subCategory: '',
    image: '' // data URL for uploaded picture
  });

  // Bulk Upload State
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<BulkAssetRow[]>([]);
  const [importedAssets, setImportedAssets] = useState<Asset[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print All Settings modal
  const [isPrintAllSettingsOpen, setIsPrintAllSettingsOpen] = useState(false);
  const [printAllSettings, setPrintAllSettings] = useState({
    units: 'inch' as 'inch' | 'mm' | 'cm',
    width: 2.7,
    height: 1.1,
    orientation: 'normal' as 'normal' | 'landscape',
  });
  const [previewAllQrUrl, setPreviewAllQrUrl] = useState<string>('');
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [printAllBatchProgress, setPrintAllBatchProgress] = useState('');
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [jspmConnected, setJspmConnected] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  // From DB (System Admin can add/remove in Settings)
  const [locationsList, setLocationsList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string; code: string; location: string }[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [assetTypesList, setAssetTypesList] = useState<{ id: string; name: string; categoryId: string; category?: { name: string } }[]>([]);
  const [assetClassesList, setAssetClassesList] = useState<{ id: string; name: string; custodianOptions: { id: string; name: string }[] }[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const locMatch = (a: string, b: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

  const MAX_IMAGE_SIZE_MB = 3;
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (e.g. JPG, PNG).');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      alert(`Image must be under ${MAX_IMAGE_SIZE_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFormData((prev) => ({ ...prev, image: reader.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const clearImage = () => setFormData((prev) => ({ ...prev, image: '' }));

  useEffect(() => {
    (async () => {
      const [locRes, deptRes, catRes, typesRes, classRes] = await Promise.all([
        getLocations(), getDepartments(), getCategories(), getAssetTypes(), getAssetClasses()
      ]);
      if (locRes.success && locRes.locations) setLocationsList(locRes.locations);
      if (deptRes.success && deptRes.departments) setDepartmentsList(deptRes.departments);
      if (catRes.success && catRes.categories) setCategoriesList(catRes.categories);
      if (typesRes.success && typesRes.assetTypes) setAssetTypesList(typesRes.assetTypes);
      if (classRes.success && classRes.assetClasses) setAssetClassesList(classRes.assetClasses);
    })();
  }, []);

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

      const atFromDb = formData.category ? assetTypesList.filter(at => at.category?.name === formData.category) : [];
      const atFromConst = formData.category ? (SUB_CATEGORIES[formData.category] || []) : [];
      if (formData.category && (atFromDb.length > 0 || atFromConst.length > 0) && !formData.subCategory) {
        newErrors.subCategory = "Asset Type is required";
      }
    }

    if (step === 1) {
      if (!formData.life || Number(formData.life) <= 0) newErrors.life = "Useful Life is required";
      if (!formData.location) newErrors.location = "Location is required";

      const branches = formData.location ? (LOCATION_BRANCHES[formData.location] || []) : [];
      const deptsForLocation = formData.location ? departmentsList.filter(d => locMatch(d.location, formData.location)) : [];
      const needsSubLocation = branches.length > 0 || deptsForLocation.length > 0;
      if (needsSubLocation && !formData.subLocation) {
        newErrors.subLocation = "Department/Unit is required";
      }
    }

    if (step === 2) {
      if (!formData.custodian) newErrors.custodian = "Assigned Custodian is required";
      if (!formData.salvageValue && formData.salvageValue !== '0') newErrors.salvageValue = "Salvage Value (or 0) is required";
      if (formData.custodian === 'Individual' && !formData.assignedUser.trim()) {
        newErrors.assignedUser = "User's Name is required when Assigned Custodian is Individual";
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
    setFormData({
      ...formData,
      location: loc,
      subLocation: '', // Reset sub-location when location changes
    });
  };

  const handleAssetClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const assetClass = e.target.value as 'General Purpose' | 'Cluster';
    setFormData({
      ...formData,
      assetClass,
      custodian: '', // Reset custodian when asset class changes
      assignedUser: '',
    });
  };

  const getLocationCode = (locationName: string) =>
    locationsList.find(l => l.name === locationName)?.code ?? (locationName && LOCATION_CODES[locationName]) ?? 'GEN';
  const getDepartmentCode = (departmentName: string) =>
    departmentsList.find(d => d.name === departmentName)?.code ?? (departmentName && DEPARTMENT_CODES[departmentName]) ?? 'GEN';

  /** Returns the prefix part of asset ID (QET/LOC/CAT/) - serial is added separately */
  const generateBarcodePrefix = (category: string, name?: string, location?: string) => {
    let catCode = 'ITE';
    const cat = category ? category.trim().toLowerCase() : '';
    const assetName = name ? name.trim().toLowerCase() : '';
    const locCode = location ? getLocationCode(location) : 'GEN';

    // Smart Category & Name Matching Logic
    if (cat === 'it equipment' || cat.includes('computer')) catCode = 'ITE';
    else if (cat === 'office equipment') catCode = 'OE';
    else if (cat.includes('vehicle') || cat.includes('car') || cat.includes('truck')) catCode = 'VH';
    else if (cat.includes('furniture') || cat.includes('fitting') || cat.includes('chair') || cat.includes('table')) catCode = 'FF';
    else if (cat.includes('plant') || cat.includes('machinery') || cat.includes('generator')) catCode = 'PMA';
    else if (cat.includes('land') || cat.includes('building')) catCode = 'LND';
    else if (cat.includes('software')) catCode = 'SFW';

    // Name based inference overrides
    else if (
      assetName.includes('photocopier') ||
      assetName.includes('printer') ||
      assetName.includes('dispenser') ||
      assetName.includes('gadget') ||
      assetName.includes('shredder') ||
      assetName.includes('scanner')
    ) {
      catCode = 'OE';
    }
    else if (
      assetName.includes('laptop') ||
      assetName.includes('monitor') ||
      assetName.includes('phone') ||
      assetName.includes('server') ||
      assetName.includes('desktop')
    ) {
      catCode = 'ITE';
    }

    // Format: QET/LOC/CAT/SERIAL
    return `QET/${locCode}/${catCode}/`;
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

    const prefix = generateBarcodePrefix(formData.category, formData.name, formData.location);
    const serial = await getNextSerialForPrefix(prefix);
    const newId = prefix + serial;
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
      assignmentType: formData.assetClass,
      assignedUser: formData.assignedUser,
      custodian: formData.custodian,
      image: formData.image || undefined,
    };

    const result = await createAsset(serverData, currentUser.id, currentUser.role);

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
      assetClass: 'General Purpose',
      custodian: '',
      assignedUser: '',
      depreciationMethod: 'Straight-Line',
      salvageValue: '',
      registrationDate: new Date().toISOString().split('T')[0],
      subCategory: '',
      image: ''
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
        <image href="./qet-logo-circular.png" x="${mid - 3.5}" y="${mid - 3.5}" width="7" height="7" clip-path="circle(50%)" />
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

  const toInch = (v: number, from: string) => from === 'inch' ? v : from === 'mm' ? v / 25.4 : v / 2.54;
  const fromInch = (v: number, to: string) => to === 'inch' ? v : to === 'mm' ? v * 25.4 : v * 2.54;

  const loadPrinters = useCallback(async () => {
    setIsLoadingPrinters(true);
    try {
      const { JSPrintManager, WSStatus } = await import('jsprintmanager');
      JSPrintManager.auto_reconnect = true;
      await JSPrintManager.start();
      if (JSPrintManager.websocket_status === WSStatus.Open) {
        const list = await JSPrintManager.getPrinters(true) as string[];
        const arr = Array.isArray(list) ? list : [];
        setPrinters(arr);
        setSelectedPrinter(arr.length > 0 ? arr[0] : '');
        setJspmConnected(true);
      } else {
        setJspmConnected(false);
      }
    } catch {
      setJspmConnected(false);
    } finally {
      setIsLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    if (isPrintAllSettingsOpen) loadPrinters();
  }, [isPrintAllSettingsOpen, loadPrinters]);

  useEffect(() => {
    if (!isPrintAllSettingsOpen || importedAssets.length === 0) { setPreviewAllQrUrl(''); return; }
    let cancelled = false;
    const firstId = importedAssets[0]?.productId || '';
    (async () => {
      try {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, firstId || 'N/A', { width: 120, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); logoImg.onerror = () => resolve(); logoImg.src = '/qet-logo-circular.png'; });
        if (logoImg.width && logoImg.height) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const logoSize = canvas.width * 0.22;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, logoSize / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(logoImg, (canvas.width - logoSize) / 2, (canvas.height - logoSize) / 2, logoSize, logoSize);
          }
        }
        if (!cancelled) setPreviewAllQrUrl(canvas.toDataURL('image/png'));
      } catch { if (!cancelled) setPreviewAllQrUrl(''); }
    })();
    return () => { cancelled = true; };
  }, [isPrintAllSettingsOpen, importedAssets]);

  const handlePrintAllTags = async (settings?: typeof printAllSettings) => {
    if (!importedAssets || importedAssets.length === 0) return;
    const s = settings || printAllSettings;
    const wRaw = s.orientation === 'landscape' ? s.height : s.width;
    const hRaw = s.orientation === 'landscape' ? s.width : s.height;
    const wIn = toInch(wRaw, s.units);
    const hIn = toInch(hRaw, s.units);
    setIsPrintingAll(true);
    const PRINT_DPI = 203;
    const pxW = Math.round(wIn * PRINT_DPI);
    const pxH = Math.round(hIn * PRINT_DPI);

    const esc = (x: string) => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const getQRDataUrl = async (text: string): Promise<string> => {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, text || 'N/A', {
        width: 200, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' },
      });
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = '/qet-logo-circular.png';
      });
      if (logoImg.width && logoImg.height) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const logoSize = canvas.width * 0.22;
          const x = (canvas.width - logoSize) / 2;
          const y = (canvas.height - logoSize) / 2;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, logoSize / 2 + 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(logoImg, x, y, logoSize, logoSize);
        }
      }
      return canvas.toDataURL('image/png');
    };

    const getBarcodeUrl = (text: string): string => {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, text || 'N/A', {
          format: 'CODE128', width: 1.5, height: Math.round(pxH * 0.12), displayValue: false,
        });
        return canvas.toDataURL('image/png');
      } catch { return ''; }
    };

    const labelData = await Promise.all(
      importedAssets.map(async (asset) => ({
        asset,
        qrUrl: await getQRDataUrl(asset.productId || ''),
        barcodeUrl: getBarcodeUrl(asset.productId || ''),
      }))
    );

    const fsH2 = Math.max(6, Math.round(pxH * 0.1));
    const fsV = Math.max(8, Math.round(pxH * 0.14));
    const qrPx = Math.min(pxW, pxH) * 0.5;
    const barcodeH = Math.round(pxH * 0.12);

    const labelsHtml = labelData.map(({ asset, qrUrl, barcodeUrl }) => `
      <div style="width:${pxW}px;height:${pxH}px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${Math.round(pxH * 0.02)}px;font-family:'Segoe UI',Arial,sans-serif;box-sizing:border-box;color:#000;padding:3%;border:1px solid #ccc;break-inside:avoid;page-break-inside:avoid;">
        <div style="font-size:${fsH2}px;font-weight:700;letter-spacing:0.5px;color:#000;">Property of Abdulkadeer &amp; Co.</div>
        <div style="width:${qrPx}px;height:${qrPx}px;display:flex;justify-content:center;align-items:center;padding:4px;background:#fff;border:1px solid #333;">
          <img src="${qrUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;" />
        </div>
        <div style="font-size:${Math.round(fsV * 0.55)}px;font-weight:600;color:#000;line-height:1.2;max-width:100%;min-height:${Math.round(pxH * 0.06)}px;">${esc(asset.name || '')}</div>
        <div style="font-size:${fsV}px;font-weight:800;font-family:Consolas,monospace;color:#000;">${esc(asset.productId || '')}</div>
        ${barcodeUrl ? `<div style="height:${barcodeH}px;display:flex;justify-content:center;align-items:center;"><img src="${barcodeUrl}" alt="Barcode" style="max-width:100%;height:100%;object-fit:contain;" /></div>` : ''}
      </div>
    `).join('');

    const printHtml = `<!DOCTYPE html><html><head><title>Print All Asset Tags</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.grid{display:flex;flex-wrap:wrap;gap:6px;padding:8px;}@media print{@page{size:${wIn}in ${hIn}in;margin:0}.grid{gap:0;padding:0;}}</style></head><body><div class="grid">${labelsHtml}</div></body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open(); iframeDoc.write(printHtml); iframeDoc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 800);
    }
    setIsPrintingAll(false);
  };

  const handlePrintAllDirect = async () => {
    if (!importedAssets || importedAssets.length === 0) return;
    if (!jspmConnected) {
      alert('JSPM Client is not connected. Install and run JSPM from https://neodynamic.com/downloads/jspm for direct printing.');
      return;
    }
    setIsPrintingAll(true);
    setPrintAllBatchProgress('');
    setIsPrintAllSettingsOpen(false);
    try {
      const { JSPrintManager, ClientPrintJob, InstalledPrinter, DefaultPrinter, PrintFile, FileSourceType, WSStatus } = await import('jsprintmanager');
      if (JSPrintManager.websocket_status !== WSStatus.Open) {
        alert('JSPM Client is not connected. Please install and run JSPM from https://neodynamic.com/downloads/jspm');
        return;
      }
      const s = printAllSettings;
      const wRaw = s.orientation === 'landscape' ? s.height : s.width;
      const hRaw = s.orientation === 'landscape' ? s.width : s.height;
      const wIn = toInch(wRaw, s.units);
      const hIn = toInch(hRaw, s.units);
      const PRINT_DPI = 203;
      const pxW = Math.round(wIn * PRINT_DPI);
      const pxH = Math.round(hIn * PRINT_DPI);
      const po = s.orientation === 'landscape' ? 'L' : 'P';
      const printerSpec = `PX=0-PY=0-PW=${wIn.toFixed(3)}-PH=${hIn.toFixed(3)}-PO=${po}`;
      const GEN_BATCH = 50;
      const total = importedAssets.length;

      const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
        const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
      });

      const makeQRDataUrl = async (productId: string): Promise<string> => {
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, productId || 'N/A', { width: 300, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); logoImg.onerror = () => resolve(); logoImg.src = '/qet-logo-circular.png'; });
        if (logoImg.width && logoImg.height) {
          const ctx = qrCanvas.getContext('2d');
          if (ctx) {
            const logoSize = qrCanvas.width * 0.22;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(qrCanvas.width / 2, qrCanvas.height / 2, logoSize / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(logoImg, (qrCanvas.width - logoSize) / 2, (qrCanvas.height - logoSize) / 2, logoSize, logoSize);
          }
        }
        return qrCanvas.toDataURL('image/png');
      };

      const renderLabel = async (asset: { productId?: string; name?: string }): Promise<string> => {
        const qrDataUrl = await makeQRDataUrl(asset.productId || '');
        let barcodeDataUrl = '';
        try {
          const bc = document.createElement('canvas');
          JsBarcode(bc, asset.productId || 'N/A', { format: 'CODE128', width: 1.2, height: Math.round(pxH * 0.12), displayValue: false });
          barcodeDataUrl = bc.toDataURL('image/png');
        } catch { /* ignore */ }
        const fsH2 = Math.max(6, Math.round(pxH * 0.1));
        const fsV = Math.max(8, Math.round(pxH * 0.14));
        const fsName = Math.round(fsV * 0.55);
        const qrPx = Math.min(pxW, pxH) * 0.5;
        const barcodeH = Math.round(pxH * 0.12);
        const gap = Math.round(pxH * 0.025);
        const pad = Math.round(Math.min(pxW, pxH) * 0.03);
        const canvas = document.createElement('canvas');
        canvas.width = pxW; canvas.height = pxH;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pxW, pxH);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#000';
        let y = pad;
        ctx.font = `bold ${fsH2}px "Segoe UI",Arial,sans-serif`;
        ctx.fillText('Property of Abdulkadeer & Co.', pxW / 2, y); y += fsH2 + gap;
        const qrImg = await loadImg(qrDataUrl);
        const qrX = (pxW - qrPx) / 2;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.strokeRect(qrX - 4, y - 4, qrPx + 8, qrPx + 8);
        ctx.drawImage(qrImg, qrX, y, qrPx, qrPx); y += qrPx + gap;
        ctx.font = `600 ${fsName}px "Segoe UI",Arial,sans-serif`;
        ctx.fillText(asset.name || '', pxW / 2, y); y += fsName + gap;
        ctx.font = `bold ${fsV}px Consolas,monospace`;
        ctx.fillText(asset.productId || '', pxW / 2, y); y += fsV + gap;
        if (barcodeDataUrl) {
          const bcImg = await loadImg(barcodeDataUrl);
          const bcW = Math.min(pxW - pad * 2, barcodeH * (bcImg.width / bcImg.height));
          ctx.drawImage(bcImg, (pxW - bcW) / 2, y, bcW, barcodeH);
        }
        return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      };

      // Phase 1: generate all PNGs in parallel batches
      const allBase64: string[] = [];
      for (let start = 0; start < total; start += GEN_BATCH) {
        setPrintAllBatchProgress(`Generating ${Math.min(start + GEN_BATCH, total)} of ${total}...`);
        const batch = importedAssets.slice(start, start + GEN_BATCH);
        const rendered = await Promise.all(batch.map(renderLabel));
        allBase64.push(...rendered);
      }

      // Phase 2: send each label as its own job (PNG — no extra software needed)
      for (let i = 0; i < allBase64.length; i++) {
        setPrintAllBatchProgress(`Sending ${i + 1} of ${total} to printer...`);
        const cpj = new ClientPrintJob();
        cpj.clientPrinter = selectedPrinter ? new InstalledPrinter(selectedPrinter) : new DefaultPrinter();
        cpj.files.push(new PrintFile(allBase64[i], FileSourceType.Base64, `label-${printerSpec}.png`, 1));
        await cpj.sendToClient();
      }
      setPrintAllBatchProgress('');
    } catch (err) {
      console.error('Direct print all error:', err);
      setPrintAllBatchProgress('');
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      alert('Direct print error: ' + msg);
    } finally {
      setIsPrintingAll(false);
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

        // Helper function to parse Excel dates
        const parseExcelDate = (value: any): string => {
          if (!value) return '';
          
          // If it's already a valid date string in YYYY-MM-DD format
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
          }
          
          // If it's an Excel serial number (numeric)
          if (typeof value === 'number') {
            // Excel epoch starts from January 1, 1900, but Excel incorrectly treats 1900 as a leap year
            // So we need to adjust: Excel serial 1 = Jan 1, 1900
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899 (Excel's epoch)
            const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
            if (!isNaN(date.getTime())) {
              return date.toISOString().split('T')[0];
            }
          }
          
          // Try parsing as a date string
          if (typeof value === 'string') {
            // Try various date formats
            const dateFormats = [
              /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
              /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
              /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
              /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
            ];
            
            for (const format of dateFormats) {
              if (format.test(value)) {
                const parsed = new Date(value);
                if (!isNaN(parsed.getTime())) {
                  return parsed.toISOString().split('T')[0];
                }
              }
            }
            
            // Try direct Date parsing
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
            }
          }
          
          return '';
        };

        const initialRows = jsonData.map((row: any, index: number) => ({
          rowId: index,
          name: row['Asset Name*'] || row['Asset Name'] || row['Name'] || '',
          category: row['Category*'] || row['Category'] || '',
          subCategory: row['Asset Type (for IT/Office)*'] || row['Asset Type'] || row['Sub-Category'] || '',
          cost: row['Acquisition Cost*'] || row['Acquisition Cost'] || row['Cost'] || 0,
          date: parseExcelDate(row['Acquisition Date*'] || row['Acquisition Date'] || row['Date'] || ''),
          registrationDate: parseExcelDate(row['Registration Date*'] || row['Registration Date'] || ''),
          vendor: row['Vendor Name*'] || row['Vendor Name'] || row['Vendor'] || '',
          invoice: row['Invoice Number*'] || row['Invoice Number'] || row['Invoice'] || '',
          model: row['Model/Serial Number'] || row['Model'] || row['Serial Number'] || '',
          life: row['Useful Life (Years)*'] || row['Useful Life (Years)'] || row['Useful Life'] || row['Life'] || 0,
          location: row['Location*'] || row['Location'] || '',
          subLocation: row['Department/Unit*'] || row['Department/Unit'] || row['Department'] || row['Unit'] || '',
          condition: row['Condition'] || 'New',
          assetClass: row['Asset Class*'] || row['Asset Class'] || 'General Purpose',
          custodian: row['Assigned Custodian*'] || row['Assigned Custodian'] || row['Custodian'] || '',
          assignedUser: row['Assigned User'] || row['User'] || row["User's Name"] || '',
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
    // Removed duplicate name check to allow duplicate assets in bulk upload

    return rows.map(row => {
      const errors: string[] = [];
      const name = row.name;
      if (!name) errors.push('Missing Name');
      // Duplicate name check removed - allowing duplicates
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

  const handleBulkImport = async () => {
    const validRows = parsedData.filter(d => d.isValid);
    if (validRows.length === 0) return;

    setIsSubmitting(true);

    const rows = validRows.map(row => ({
      prefix: generateBarcodePrefix(row.category, row.name, row.location),
      name: row.name,
      category: row.category,
      subCategory: row.subCategory,
      cost: Number(row.cost),
      date: row.date || new Date().toISOString().split('T')[0],
      registrationDate: row.registrationDate || new Date().toISOString().split('T')[0],
      salvageValue: Number(row.salvageValue),
      life: Number(row.life),
      depreciationMethod: row.depreciationMethod,
      location: row.location,
      subLocation: row.subLocation,
      condition: row.condition || 'New',
      assetClass: row.assetClass,
      custodian: row.custodian,
      assignedUser: row.assignedUser,
    }));

    const result = await createAssetsBulk(rows, currentUser.id, currentUser.role);

    setIsSubmitting(false);

    if (result.success && result.createdIds && result.createdIds.length > 0) {
      const productIds = result.createdProductIds || [];
      const createdAssets: Asset[] = validRows.map((row, i) => ({
        id: result.createdIds![i] || (Date.now() + i).toString(),
        productId: productIds[i] || '',
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
        image: `https://picsum.photos/200/200?random=${Math.random()}`,
        usefulLife: Number(row.life),
        salvageValue: Number(row.salvageValue),
        previousId: row.previousId,
        registrationDate: row.registrationDate || new Date().toISOString().split('T')[0],
        subCategory: row.subCategory
      }));

      setImportedAssets(createdAssets);
      const invalidRows = parsedData.filter(d => !d.isValid);
      setParsedData(invalidRows);
    } else {
      alert(result.error || "Failed to save imported assets. Please try again.");
    }
  };

  const downloadImportedTags = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX || importedAssets.length === 0) return;
    const data = importedAssets.map(a => ({ "Asset Name": a.name, "Generated Tag ID": a.productId, "Category": a.category, "Location": a.location }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "New Asset Tags");
    XLSX.writeFile(wb, "QET_Generated_Tags.xlsx");
  };

  // Column headers must match parser and single-entry form
  const TEMPLATE_COLUMNS = {
    "Asset Name*": "",
    "Category*": "",
    "Asset Type (for IT/Office)*": "",
    "Acquisition Cost*": "",
    "Acquisition Date*": "",
    "Registration Date*": "",
    "Vendor Name*": "",
    "Invoice Number*": "",
    "Model/Serial Number": "",
    "Useful Life (Years)*": "",
    "Location*": "",
    "Department/Unit*": "",
    "Condition": "",
    "Asset Class*": "",
    "Assigned Custodian*": "",
    "Assigned User": "",
    "Salvage Value*": "",
    "Depreciation Method": "",
    "Previous ID": ""
  };

  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    const instructions = [
      { ...TEMPLATE_COLUMNS, "Asset Name*": "INSTRUCTIONS:", "Category*": "Do not delete this row." },
      { ...TEMPLATE_COLUMNS, "Asset Name*": "1. Fields with * are required." },
      { ...TEMPLATE_COLUMNS, "Asset Name*": "2. Date format: YYYY-MM-DD. Category & Location must match System Admin settings." },
      { ...TEMPLATE_COLUMNS, "Asset Name*": "3. Asset Class*: General Purpose or Cluster. Assigned Custodian* depends on Asset Class." },
      { ...TEMPLATE_COLUMNS, "Asset Name*": "4. Department/Unit* must be a department for the chosen Location*." },
      {}
    ];

    const sampleRow = {
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
      "Department/Unit*": "Advisory",
      "Condition": "New",
      "Asset Class*": "General Purpose",
      "Assigned Custodian*": "HR/Admin",
      "Assigned User": "",
      "Salvage Value*": 50000,
      "Depreciation Method": "Straight-Line",
      "Previous ID": ""
    };

    const combinedData = [...instructions, sampleRow];
    const ws = XLSX.utils.json_to_sheet(combinedData);
    const colCount = Object.keys(TEMPLATE_COLUMNS).length;
    ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "QET_Asset_Upload_Template.xlsx");
  };

  if (!canRegisterAsset(currentUser.role)) {
    return (
      <div className="max-w-4xl mx-auto pb-20">
        {onBack && (
          <button onClick={onBack} className="flex items-center text-sm text-slate-500 hover:text-qet-600 mb-6 transition-colors group">
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-amber-600 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Insufficient permissions</h2>
          <p className="text-slate-600">Only Asset Managers and System Admins can register new assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {onBack && (
        <button onClick={onBack} className="flex items-center text-sm text-slate-500 hover:text-qet-600 mb-6 transition-colors group">
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Register New Asset</h1>
        <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-medium">
          <button onClick={() => { setMode('single'); resetForm(); }} className={`px-4 py-1.5 rounded-md transition-all ${mode === 'single' ? 'bg-white text-qet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Single Entry</button>
          <button onClick={() => { setMode('bulk'); resetForm(); }} className={`px-4 py-1.5 rounded-md transition-all ${mode === 'bulk' ? 'bg-white text-qet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulk Upload</button>
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors ${index <= currentStep ? 'bg-qet-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {index < currentStep ? <CheckCircle size={16} /> : index + 1}
                    </div>
                    <span className={`text-xs font-medium ${index === currentStep ? 'text-qet-600' : 'text-slate-500'}`}>{step}</span>
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
                <div id="asset-tag-card" className="bg-slate-50 border-2 border-slate-800 rounded-xl p-6 w-full max-w-sm mb-8 relative">
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
                      <img src="./qet-logo-circular.png" className="h-12 object-contain" alt="QET Logo" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-xl mb-1 tracking-tight">QET ASSET TAG</h3>

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
                    <p className="text-[10px] text-slate-400 mt-2 uppercase">Property of Quantum Edge Technologies (QET)</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={handlePrintTag} className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                    <Printer size={18} className="mr-2" /> Print Tag
                  </button>
                  <button onClick={resetForm} className="flex items-center px-6 py-3 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors shadow-lg shadow-qet-200">
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
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.name ? 'border-red-500' : 'border-slate-300'}`} placeholder="e.g. HP EliteBook" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                        <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.category ? 'border-red-500' : 'border-slate-300'}`}>
                          <option value="">Select Category</option>
                          {(categoriesList.length > 0 ? categoriesList : CATEGORIES.map(n => ({ id: n, name: n }))).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                      </div>

                      {formData.category && (() => {
                        const fromDb = assetTypesList.filter(at => at.category?.name === formData.category);
                        const fromConst = SUB_CATEGORIES[formData.category] || [];
                        const options = fromDb.length > 0 ? fromDb.map(at => at.name) : fromConst;
                        if (options.length === 0) return null;
                        return (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type <span className="text-red-500">*</span></label>
                            <select
                              value={formData.subCategory}
                              onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                              className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.subCategory ? 'border-red-500' : 'border-slate-300'}`}
                            >
                              <option value="">Select Asset Type</option>
                              {options.map(sc => (
                                <option key={sc} value={sc}>{sc}</option>
                              ))}
                            </select>
                            {errors.subCategory && <p className="text-red-500 text-xs mt-1">{errors.subCategory}</p>}
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Cost (₦) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.cost ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00" />
                        {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Date <span className="text-red-500">*</span></label>
                        <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.date ? 'border-red-500' : 'border-slate-300'} [color-scheme:light]`} />
                        {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Registration Date <span className="text-red-500">*</span></label>
                        <input type="date" value={formData.registrationDate} onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.registrationDate ? 'border-red-500' : 'border-slate-300'} [color-scheme:light]`} />
                        {errors.registrationDate && <p className="text-red-500 text-xs mt-1">{errors.registrationDate}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.vendor ? 'border-red-500' : 'border-slate-300'}`} placeholder="Supplier Name" />
                        {errors.vendor && <p className="text-red-500 text-xs mt-1">{errors.vendor}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.invoice} onChange={(e) => setFormData({ ...formData, invoice: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.invoice ? 'border-red-500' : 'border-slate-300'}`} placeholder="INV-####" />
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
                        <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500 outline-none" placeholder="S/N" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Useful Life (Years) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.life} onChange={(e) => setFormData({ ...formData, life: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.life ? 'border-red-500' : 'border-slate-300'}`} placeholder="e.g. 5" />
                        {errors.life && <p className="text-red-500 text-xs mt-1">{errors.life}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Location <span className="text-red-500">*</span></label>
                        <select value={formData.location} onChange={handleLocationChange} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.location ? 'border-red-500' : 'border-slate-300'}`}>
                          <option value="">Select Location</option>
                          {locationsList.map(l => (
                            <option key={l.id} value={l.name}>{l.name}</option>
                          ))}
                        </select>
                        {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                      </div>

                      {formData.location && (() => {
                        const deptsForLocation = departmentsList.filter(d => locMatch(d.location, formData.location));
                        const branchOptions = LOCATION_BRANCHES[formData.location] || [];
                        const options = deptsForLocation.length > 0 ? deptsForLocation.map(d => d.name) : branchOptions;
                        if (options.length === 0) return null;
                        return (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Department / Unit <span className="text-red-500">*</span></label>
                            <select value={formData.subLocation} onChange={(e) => setFormData({ ...formData, subLocation: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.subLocation ? 'border-red-500' : 'border-slate-300'}`}>
                              <option value="">Select Department</option>
                              {options.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            {errors.subLocation && <p className="text-red-500 text-xs mt-1">{errors.subLocation}</p>}
                          </div>
                        );
                      })()}

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                        <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500 outline-none">
                          <option value="New">New</option>
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Poor">Poor</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset picture</label>
                        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        {formData.image ? (
                          <div className="relative inline-block">
                            <img src={formData.image} alt="Asset" className="max-h-48 rounded-lg border border-slate-200 object-cover shadow-sm" />
                            <button type="button" onClick={clearImage} className="absolute top-2 right-2 p-1.5 bg-slate-800/80 text-white rounded-full hover:bg-red-600 transition-colors" title="Remove picture"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-4 py-3 w-full border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-qet-500 hover:text-qet-600 hover:bg-qet-50/50 transition-colors">
                            <ImagePlus size={20} />
                            <span>Upload picture (optional, max {MAX_IMAGE_SIZE_MB} MB)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Assignment & Depreciation</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Class <span className="text-red-500">*</span></label>
                        <select
                          value={formData.assetClass}
                          onChange={handleAssetClassChange}
                          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500 outline-none"
                        >
                          {(assetClassesList.length > 0 ? assetClassesList.map(ac => ac.name) : ASSET_CLASS_OPTIONS).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Custodian <span className="text-red-500">*</span></label>
                        <select
                          value={formData.custodian}
                          onChange={(e) => setFormData({ ...formData, custodian: e.target.value })}
                          className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 outline-none ${errors.custodian ? 'border-red-500' : 'border-slate-300'}`}
                        >
                          <option value="">Select Assigned Custodian</option>
                          {(assetClassesList.length > 0
                            ? (assetClassesList.find(ac => ac.name === formData.assetClass)?.custodianOptions?.map(o => o.name) || [])
                            : (CUSTODIAN_BY_ASSET_CLASS[formData.assetClass] || [])).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {errors.custodian && <p className="text-red-500 text-xs mt-1">{errors.custodian}</p>}
                      </div>

                      {formData.custodian === 'Individual' && (
                        <div className="animate-slideIn md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Assigned custodian name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={formData.assignedUser}
                            onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                            placeholder="Enter the individual's full name"
                            className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 outline-none ${errors.assignedUser ? 'border-red-500' : 'border-slate-300'}`}
                          />
                          {errors.assignedUser && <p className="text-red-500 text-xs mt-1">{errors.assignedUser}</p>}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Method</label>
                        <select value={formData.depreciationMethod} onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500 outline-none">
                          <option value="Straight-Line">Straight-Line</option>
                          <option value="Reducing Balance">Reducing Balance</option>
                          <option value="Sum of Years">Sum of Years</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Salvage Value (₦) <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.salvageValue} onChange={(e) => setFormData({ ...formData, salvageValue: e.target.value })} className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-qet-500 ${errors.salvageValue ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00" />
                        {errors.salvageValue && <p className="text-red-500 text-xs mt-1">{errors.salvageValue}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button type="button" onClick={handleBack} disabled={currentStep === 0} className={`px-6 py-2 rounded-lg text-sm font-medium ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}>Back</button>
                  {currentStep < steps.length - 1 ? (
                    <button type="button" onClick={handleNext} className="flex items-center px-6 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors">Next Step <ChevronRight size={16} className="ml-2" /></button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="flex items-center px-8 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors shadow-lg shadow-qet-200">{isSubmitting ? 'Processing...' : (<>Save & Generate ID <Save size={16} className="ml-2" /></>)}</button>
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
                    <button onClick={() => setIsPrintAllSettingsOpen(true)} className="text-xs text-qet-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-qet-200 rounded"><Printer size={14} className="mr-1" /> Print All Tags</button>
                    <button onClick={downloadImportedTags} className="text-xs text-qet-600 font-bold hover:underline flex items-center px-2 py-1 bg-white border border-qet-200 rounded"><Download size={14} className="mr-1" /> Export List</button>
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
                          <td className="p-3"><input type="text" value={asset.name} onChange={(e) => handleSuccessEdit(asset.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-800 font-medium transition-colors" /></td>
                          <td className="p-3 font-mono text-slate-500 text-xs">{asset.previousId || '-'}</td>
                          <td className="p-3"><div className="flex items-center gap-3"><div className="h-8 w-24 bg-white border border-slate-200 flex items-center justify-center px-1"><div className="flex items-end h-5 space-x-[1px] w-full justify-center opacity-80">{[...Array(25)].map((_, i) => <div key={i} className="bg-slate-900" style={{ width: Math.random() > 0.5 ? '1px' : '2px', height: `${30 + Math.random() * 70}%` }}></div>)}</div></div><span className="font-mono text-qet-700 font-bold">{asset.productId}</span></div></td>
                          <td className="p-3 text-slate-500 text-xs"><select value={asset.category} onChange={(e) => handleSuccessEdit(asset.id, 'category', e.target.value)} className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 w-full">{(categoriesList.length > 0 ? categoriesList : CATEGORIES.map(n => ({ id: n, name: n }))).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-3"><button onClick={resetForm} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium">Upload Another File</button><button onClick={() => { if (onBack) onBack(); }} className="px-6 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 font-medium shadow-md">Return to Dashboard</button></div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center mb-8"><div className="text-center max-w-lg"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-qet-600"><FileSpreadsheet size={32} /></div><h2 className="text-xl font-bold text-slate-800 mb-2">Upload Asset Data File</h2><p className="text-slate-500 text-sm mb-6">Support for Excel (.xlsx, .xls) and CSV. Ensure your file matches the template structure.</p><button onClick={downloadTemplate} className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors mb-6"><Download size={16} className="mr-2" /> Download Template</button></div><div className={`w-full max-w-2xl h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${dragActive ? 'border-qet-500 bg-qet-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}><UploadCloud size={40} className={`mb-3 ${dragActive ? 'text-qet-600' : 'text-slate-400'}`} /><p className="text-sm font-medium text-slate-700">Drag & Drop your file here</p><p className="text-xs text-slate-400 mt-1">or click to browse</p><input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} /></div></div>
              {isProcessingFile && <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qet-600"></div><span className="ml-3 text-slate-600 font-medium">Processing file...</span></div>}
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
                              <input type="text" value={row.name} onChange={(e) => handlePreviewChange(row.rowId, 'name', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 font-medium text-slate-800 transition-colors" />
                            </td>
                            <td className="p-3">
                              <select value={row.category} onChange={(e) => handlePreviewChange(row.rowId, 'category', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-600">
                                <option value="">Select...</option>
                                {(categoriesList.length > 0 ? categoriesList : CATEGORIES.map(n => ({ id: n, name: n }))).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className="p-3">
                              <input type="text" value={row.subCategory} onChange={(e) => handlePreviewChange(row.rowId, 'subCategory', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-600" />
                            </td>
                            <td className="p-3">
                              <input type="date" value={row.date} onChange={(e) => handlePreviewChange(row.rowId, 'date', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-600 [color-scheme:light]" />
                            </td>
                            <td className="p-3">
                              <input type="date" value={row.registrationDate} onChange={(e) => handlePreviewChange(row.rowId, 'registrationDate', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-600 [color-scheme:light]" />
                            </td>
                            <td className="p-3">
                              <input type="number" value={row.cost} onChange={(e) => handlePreviewChange(row.rowId, 'cost', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-qet-500 focus:bg-white focus:outline-none py-1 text-slate-600" />
                            </td>
                            <td className="p-3 text-red-600 text-xs font-semibold">{row.errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-4">
                    <button onClick={() => setParsedData([])} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Clear</button>
                    <button onClick={handleBulkImport} disabled={isSubmitting || parsedData.filter(d => d.isValid).length === 0} className="px-6 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors shadow-lg shadow-qet-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                      {isSubmitting ? 'Importing...' : 'Import Valid Assets'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Print All Tags Settings Modal */}
      {isPrintAllSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Printer size={20} className="text-slate-600" /> Print All Tags — Settings
              </h3>
              <button onClick={() => setIsPrintAllSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {/* Printer selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Printer</label>
                {jspmConnected && printers.length > 0 ? (
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500"
                  >
                    {printers.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Install JSPM Client to select printers directly. <a href="https://neodynamic.com/downloads/jspm" target="_blank" rel="noopener noreferrer" className="text-qet-600 hover:underline">Download</a></p>
                    <button
                      type="button"
                      onClick={loadPrinters}
                      disabled={isLoadingPrinters}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isLoadingPrinters ? <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" /> : null}
                      Load printers
                    </button>
                  </div>
                )}
              </div>

              {/* Label preview */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Label preview (first asset)</label>
                <div
                  className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm mx-auto"
                  style={(() => {
                    const aspect = printAllSettings.orientation === 'landscape'
                      ? printAllSettings.height / printAllSettings.width
                      : printAllSettings.width / printAllSettings.height;
                    const maxW = 220, maxH = 140;
                    const w = aspect >= maxW / maxH ? maxW : maxH * aspect;
                    const h = aspect >= maxW / maxH ? maxW / aspect : maxH;
                    return { width: Math.round(w), height: Math.round(h) };
                  })()}
                >
                  <div className="flex flex-col h-full items-center justify-center text-center gap-1 p-2 overflow-hidden">
                    <div style={{ fontSize: 8 }} className="font-bold shrink-0">Property of Abdulkadeer &amp; Co.</div>
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white border border-slate-200 p-0.5">
                      {previewAllQrUrl
                        ? <img src={previewAllQrUrl} alt="QR" className="w-full h-full object-contain" />
                        : <div className="w-full h-full bg-slate-100 animate-pulse rounded" />}
                    </div>
                    <div style={{ fontSize: 6 }} className="font-semibold text-slate-800 shrink-0 break-words w-full px-1">{importedAssets[0]?.name || '-'}</div>
                    <div style={{ fontSize: 9 }} className="font-mono font-bold truncate max-w-full shrink-0">{importedAssets[0]?.productId || '-'}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 text-center">{importedAssets.length} tags will be printed</p>
              </div>

              {/* Units */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Units</label>
                <select
                  value={printAllSettings.units}
                  onChange={(e) => {
                    const newUnit = e.target.value as 'inch' | 'mm' | 'cm';
                    const u = printAllSettings.units;
                    const wI = toInch(printAllSettings.width, u);
                    const hI = toInch(printAllSettings.height, u);
                    setPrintAllSettings(p => ({
                      ...p,
                      units: newUnit,
                      width: Math.round(fromInch(wI, newUnit) * 100) / 100,
                      height: Math.round(fromInch(hI, newUnit) * 100) / 100,
                    }));
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500"
                >
                  <option value="inch">inch</option>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                </select>
              </div>

              {/* Width */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.01" min="0.5" max="50"
                    value={printAllSettings.width}
                    onChange={(e) => setPrintAllSettings(p => ({ ...p, width: parseFloat(e.target.value) || 2.7 }))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500"
                  />
                  <span className="text-sm text-slate-500 shrink-0">{printAllSettings.units}</span>
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.01" min="0.5" max="50"
                    value={printAllSettings.height}
                    onChange={(e) => setPrintAllSettings(p => ({ ...p, height: parseFloat(e.target.value) || 1.1 }))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500"
                  />
                  <span className="text-sm text-slate-500 shrink-0">{printAllSettings.units}</span>
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
                <select
                  value={printAllSettings.orientation}
                  onChange={(e) => setPrintAllSettings(p => ({ ...p, orientation: e.target.value as 'normal' | 'landscape' }))}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500"
                >
                  <option value="normal">Normal</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Tip: In the print dialog, set paper size to match your label ({printAllSettings.width}×{printAllSettings.height} {printAllSettings.units}).
            </p>

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button onClick={() => setIsPrintAllSettingsOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              {jspmConnected && printers.length > 0 ? (
                <button
                  onClick={handlePrintAllDirect}
                  disabled={isPrintingAll}
                  className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer size={16} />
                  {isPrintingAll ? (printAllBatchProgress || 'Preparing...') : `Print to ${selectedPrinter || 'Printer'}`}
                </button>
              ) : (
                <button
                  onClick={() => { setIsPrintAllSettingsOpen(false); handlePrintAllTags(printAllSettings); }}
                  disabled={isPrintingAll}
                  className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer size={16} />
                  {isPrintingAll ? 'Preparing...' : `Print All ${importedAssets.length} Tags`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetForm;