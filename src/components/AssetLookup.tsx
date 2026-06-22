
"use client";

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Scan, Search, MapPin, User, Calendar, AlertTriangle, ArrowRightLeft, FileText, Camera, X, Loader2, Image as ImageIcon, ChevronRight, ScanLine, Calculator, RefreshCw, Table, Printer, History, Briefcase, Activity, Filter, CheckCircle2, BoxSelect, TrendingUp, TrendingDown, Truck, ArrowLeft, LocateFixed, FileSpreadsheet, Download, QrCode } from 'lucide-react';
import { CONDITION_DESCRIPTIONS, LOCATIONS, LOCATION_BRANCHES } from '@/constants';
import { Asset, ConditionCode, AuditSession, AuditVerification, User as UserType, AssetImprovement } from '@/types';
import { calculateDepreciationSchedule, calculateMonthlyDepreciationSchedule } from '@/utils/depreciation';
import { assetService } from '@/services/assets';
import { transferService } from '@/services/transfers';
import { canInitiateTransfer, canApproveTransfer, canStartAudit } from '@/lib/permissions';
import { downloadCsv, arraysToCsv, rowsToCsv } from '@/utils/csv';
import { useToast } from './Toast';

const LABEL_OWNER = 'Property of Quantum Edge Technologies (QET)';
const LABEL_OWNER_HTML = 'Property of Quantum Edge Technologies (QET)';

const DepreciationView = ({ activeAsset }: { activeAsset: Asset }) => {
  const [viewMode, setViewMode] = useState<'Annual' | 'Monthly'>('Annual');
  const [calcLife, setCalcLife] = useState(activeAsset.usefulLife || 5);
  const [calcSalvage, setCalcSalvage] = useState(activeAsset.salvageValue || 0);

  const schedule = calculateDepreciationSchedule({
    acquisition_cost: activeAsset.acquisitionCost,
    registration_date: activeAsset.registrationDate || activeAsset.acquisitionDate,
    useful_life: calcLife || activeAsset.usefulLife || 5,
    salvage_value: calcSalvage || 0,
    method: (activeAsset.method as any) || 'STRAIGHT_LINE'
  });

  const monthlySchedule = calculateMonthlyDepreciationSchedule({
    acquisition_cost: activeAsset.acquisitionCost,
    registration_date: activeAsset.registrationDate || activeAsset.acquisitionDate,
    useful_life: calcLife || activeAsset.usefulLife || 5,
    salvage_value: calcSalvage || 0,
    method: (activeAsset.method as any) || 'STRAIGHT_LINE'
  });

  const currentYear = new Date().getFullYear();
  const currentEntry = schedule.find(s => s.fiscal_year === currentYear);

  // Robust Fallbacks
  const currentNBV = currentEntry
    ? (activeAsset.acquisitionCost - currentEntry.accumulated_depreciation)
    : (activeAsset.acquisitionCost);

  const lastEntry = schedule[schedule.length - 1];
  const effectiveNBV = (currentYear > (lastEntry?.fiscal_year || 0)) ? (calcSalvage || 0) : currentNBV;

  const accumDep = activeAsset.acquisitionCost - effectiveNBV;
  const currentExpense = currentEntry ? currentEntry.depreciation_expense : 0;

  const percentDepreciated = (accumDep / activeAsset.acquisitionCost) * 100;

  return (
    <>
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-qet-300 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown size={48} className="text-blue-600" /></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Net Book Value</p>
          <h3 className="text-2xl font-bold text-slate-800">₦{effectiveNBV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          <div className="mt-2 text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded">
            {(100 - percentDepreciated).toFixed(1)}% Remaining
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-orange-300 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={48} className="text-orange-600" /></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Accumulated Depr.</p>
          <h3 className="text-2xl font-bold text-slate-800">₦{accumDep.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(percentDepreciated, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={48} className="text-purple-600" /></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">This Year's Expense</p>
          <h3 className="text-2xl font-bold text-slate-800">₦{currentExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          <p className="text-xs text-slate-400 mt-2">Fiscal Year {currentYear}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><RefreshCw size={48} className="text-blue-600" /></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Methodology</p>
          <h3 className="text-lg font-bold text-slate-800 break-words line-clamp-1" title={activeAsset.method}>{activeAsset.method?.replace('_', ' ') || 'Straight Line'}</h3>
          <p className="text-xs text-slate-400 mt-2">Life: {activeAsset.usefulLife} Years</p>
        </div>
      </div>

      {/* 2. Visual Chart & Ledger Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
            <Activity size={18} className="text-qet-600" /> Depreciation Trajectory (Annual)
          </h4>
          <div className="h-64 flex items-end justify-between gap-2 px-2 pb-2 border-b border-slate-200">
            {schedule.map((entry, idx) => {
              const heightPercent = ((activeAsset.acquisitionCost - entry.accumulated_depreciation) / activeAsset.acquisitionCost) * 100;
              const isPast = entry.fiscal_year < currentYear;
              const isCurrent = entry.fiscal_year === currentYear;

              return (
                <div key={entry.year} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-20 whitespace-nowrap shadow-xl">
                    <p className="font-bold">{entry.fiscal_year}</p>
                    <p>Value: ₦{(activeAsset.acquisitionCost - entry.accumulated_depreciation).toLocaleString()}</p>
                  </div>

                  <div
                    className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 relative cursor-pointer ${isCurrent ? 'bg-qet-600 shadow-lg shadow-qet-200' : isPast ? 'bg-slate-300 hover:bg-slate-400' : 'bg-qet-200 hover:bg-qet-300'}`}
                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                  >
                    {isCurrent && <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <span className={`text-[10px] mt-2 font-medium ${isCurrent ? 'text-qet-700 font-bold bg-qet-50 px-1 rounded' : 'text-slate-400'}`}>{entry.fiscal_year}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detailed Ledger */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">
              <Table size={18} className="text-slate-500" /> Depreciation Schedule
            </h4>
            <div className="flex bg-white rounded-lg border border-slate-200 p-1">
              <button onClick={() => setViewMode('Annual')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'Annual' ? 'bg-qet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>Annual</button>
              <button onClick={() => setViewMode('Monthly')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'Monthly' ? 'bg-qet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>Monthly</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm relative">
              <thead className="text-slate-500 bg-slate-50 font-semibold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-6">{viewMode === 'Annual' ? 'Fiscal Year' : 'Period'}</th>
                  <th className="py-3 px-6 text-right">Opening Book Value</th>
                  <th className="py-3 px-6 text-right">Depreciation Exp.</th>
                  <th className="py-3 px-6 text-right">Accumulated Depr.</th>
                  <th className="py-3 px-6 text-right">Closing Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewMode === 'Annual' ? (
                  schedule.map((entry) => {
                    const isCurrent = entry.fiscal_year === currentYear;
                    const opening = activeAsset.acquisitionCost - entry.accumulated_depreciation + entry.depreciation_expense;
                    const closing = activeAsset.acquisitionCost - entry.accumulated_depreciation;

                    return (
                      <tr key={entry.fiscal_year} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                        <td className="py-3 px-6 font-medium text-slate-700">
                          {entry.fiscal_year}
                          {isCurrent && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider">Current</span>}
                        </td>
                        <td className="py-3 px-6 text-right text-slate-600">₦{opening.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-3 px-6 text-right text-red-600 font-medium bg-red-50/30">
                          (₦{entry.depreciation_expense.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </td>
                        <td className="py-3 px-6 text-right text-slate-500">₦{entry.accumulated_depreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-3 px-6 text-right font-bold text-slate-800">₦{closing.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })
                ) : (
                  monthlySchedule.map((entry, idx) => {
                    const isCurrent = entry.year === currentYear && entry.month === (new Date().getMonth() + 1);
                    const opening = activeAsset.acquisitionCost - entry.accumulated_depreciation + entry.depreciation_expense;

                    return (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                        <td className="py-2 px-6 font-medium text-slate-700 text-xs">
                          {entry.month_label} {entry.year}
                        </td>
                        <td className="py-2 px-6 text-right text-slate-600 text-xs">₦{opening.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-2 px-6 text-right text-red-600 font-medium bg-red-50/30 text-xs">
                          (₦{entry.depreciation_expense.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </td>
                        <td className="py-2 px-6 text-right text-slate-500 text-xs">₦{entry.accumulated_depreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-2 px-6 text-right font-bold text-slate-800 text-xs">₦{entry.net_book_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Simulator Section */}
      <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 mt-4 transition-all hover:border-qet-300 hover:shadow-sm h-fit">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm text-slate-400">
            <Calculator size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-slate-800 mb-1">Depreciation Simulator</h4>
            <p className="text-sm text-slate-500 mb-4">Simulate how changing the useful life or salvage value would impact the schedule.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Useful Life (Years)</label>
                <input type="number" value={calcLife} onChange={e => setCalcLife(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Salvage Value (₦)</label>
                <input type="number" value={calcSalvage} onChange={e => setCalcSalvage(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

interface AssetListViewProps {
  onClose: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onSelectAsset: (asset: Asset) => void;
  showExportOptions: boolean;
  setShowExportOptions: (show: boolean) => void;
  assets: Asset[];
  selectedIds: Set<string>;
  onToggleSelect: (productId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onPrintSelected: () => void;
  onPrintAll: () => void;
}

const AssetListView: React.FC<AssetListViewProps> = memo(({
  onClose,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onSelectAsset,
  showExportOptions,
  setShowExportOptions,
  assets,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onPrintSelected,
  onPrintAll,
}) => {
  const allSelected = assets.length > 0 && assets.every(a => selectedIds.has(a.productId));
  const someSelected = selectedIds.size > 0;
  return (
  <div className="animate-fadeIn space-y-4">
    {/* Top toolbar */}
    <div className="flex justify-between items-center mb-2 flex-wrap gap-3">
      <button
        onClick={onClose}
        className="flex items-center text-sm text-slate-500 hover:text-qet-600 transition-colors group"
      >
        <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
        Back to Asset Management
      </button>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Always visible Print All Tags button */}
        <button
          onClick={onPrintAll}
          className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors shadow-sm flex items-center gap-2 font-medium"
        >
          <Printer size={16} />
          Print All Tags
        </button>
        <div className="relative">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 font-medium"
          >
            <Download size={18} />
            Export Assets
          </button>
          {showExportOptions && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
              <button onClick={onExportExcel} className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <FileSpreadsheet size={18} className="text-green-600" />
                Export to CSV
              </button>
              <button onClick={onExportCSV} className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <FileText size={18} className="text-blue-600" />
                Export to CSV
              </button>
              <button onClick={onExportPDF} className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <FileText size={18} className="text-red-600" />
                Export to PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Selection action bar — appears when checkboxes are ticked */}
    {someSelected && (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-qet-50 border border-qet-200 rounded-lg flex-wrap">
        <CheckCircle2 size={16} className="text-qet-600 shrink-0" />
        <span className="text-sm text-qet-700"><strong>{selectedIds.size}</strong> asset{selectedIds.size > 1 ? 's' : ''} selected</span>
        <button
          onClick={onPrintSelected}
          className="ml-1 px-3 py-1.5 bg-qet-600 text-white rounded-lg hover:bg-qet-700 text-sm flex items-center gap-1.5 font-medium"
        >
          <Printer size={14} />
          Print Selected ({selectedIds.size})
        </button>
        <button onClick={someSelected && !allSelected ? onSelectAll : onClearAll} className="px-3 py-1.5 text-sm text-qet-600 hover:underline">
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <button onClick={onClearAll} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white ml-auto">
          Clear
        </button>
      </div>
    )}


    {someSelected && (
      <div className="px-4 py-2 bg-qet-50 border border-qet-200 rounded-lg text-sm text-qet-700 flex items-center gap-2">
        <CheckCircle2 size={16} />
        <span><strong>{selectedIds.size}</strong> asset{selectedIds.size > 1 ? 's' : ''} selected for printing</span>
        <button onClick={onSelectAll} className="ml-auto text-xs underline hover:no-underline">
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    )}

    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={allSelected ? onClearAll : onSelectAll}
                  className="w-4 h-4 accent-qet-600 cursor-pointer"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                />
              </th>
              <th className="p-4 font-semibold">Tag ID</th>
              <th className="p-4 font-semibold">Asset Name</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold whitespace-nowrap">Asset Type</th>
              <th className="p-4 font-semibold">Location</th>
              <th className="p-4 font-semibold">Department</th>
              <th className="p-4 font-semibold">Custodian</th>
              <th className="p-4 font-semibold text-right">Cost (₦)</th>
              <th className="p-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset.productId);
              return (
              <tr
                key={asset.id}
                className={`hover:bg-slate-50 transition-colors group cursor-pointer ${isSelected ? 'bg-qet-50' : ''}`}
              >
                <td className="p-4" onClick={(e) => { e.stopPropagation(); onToggleSelect(asset.productId); }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(asset.productId)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 accent-qet-600 cursor-pointer"
                  />
                </td>
                <td className="p-4 font-mono font-medium text-qet-600 cursor-pointer" onClick={() => onSelectAsset(asset)}>{asset.productId}</td>
                <td className="p-4 font-bold text-slate-800 cursor-pointer" onClick={() => onSelectAsset(asset)}>{asset.name}</td>
                <td className="p-4 text-slate-600 text-xs cursor-pointer" onClick={() => onSelectAsset(asset)}>
                  <span className="px-2 py-1 bg-slate-100 rounded-md uppercase tracking-wider">{asset.category}</span>
                </td>
                <td className="p-4 text-slate-500 cursor-pointer" onClick={() => onSelectAsset(asset)}>{asset.subCategory || '-'}</td>
                <td className="p-4 text-slate-600 cursor-pointer" onClick={() => onSelectAsset(asset)}>
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" />
                    {asset.location}
                  </div>
                </td>
                <td className="p-4 text-slate-500 cursor-pointer" onClick={() => onSelectAsset(asset)}>{asset.subLocation || '-'}</td>
                <td className="p-4 text-slate-600 cursor-pointer" onClick={() => onSelectAsset(asset)}>{asset.custodian}</td>
                <td className="p-4 text-right font-medium text-slate-800 cursor-pointer" onClick={() => onSelectAsset(asset)}>
                  {asset.acquisitionCost.toLocaleString()}
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSelectAsset(asset)}>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${asset.status === 'Active' ? 'bg-green-100 text-green-700' :
                    asset.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    {asset.status}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
});

interface AssetLookupProps {
  initialSearchTerm?: string;
  initialAssetId?: string;
  managementMode?: boolean;
  currentUser?: UserType;
  onBack?: () => void;
  assets?: Asset[];
  users?: { id: string; name: string; email?: string; role?: string }[];
  onDataChange?: () => void;
}

const AssetLookup: React.FC<AssetLookupProps> = ({
  initialSearchTerm = '',
  initialAssetId,
  managementMode = false,
  currentUser,
  onBack,
  assets = [],
  users = [],
  onDataChange
}) => {
  const { toast } = useToast();
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
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isBarcodeGunReady, setIsBarcodeGunReady] = useState(false);

  // Image Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadAssetId, setImageUploadAssetId] = useState<string | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const assetImageUploadInputRef = useRef<HTMLInputElement>(null);

  // Selection for Print Selected
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [isPrintSelectedOpen, setIsPrintSelectedOpen] = useState(false);
  const [isPrintingSelected, setIsPrintingSelected] = useState(false);
  const [printBatchProgress, setPrintBatchProgress] = useState('');
  const [previewSelectedQrUrl, setPreviewSelectedQrUrl] = useState<string>('');

  // Print Settings State
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    units: 'inch' as 'inch' | 'mm' | 'cm',
    width: 2.7,
    height: 1.1,
    orientation: 'normal' as 'normal' | 'landscape',
    colorMode: 'color' as 'color' | 'grayscale',
  });
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [jspmConnected, setJspmConnected] = useState(false);
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');
  const [previewBarcodeUrl, setPreviewBarcodeUrl] = useState<string>('');

  // Handle image upload for assets without pictures
  const handleImageUploadClick = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    setImageUploadAssetId(assetId);
    assetImageUploadInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageUploadAssetId || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file (e.g. JPG, PNG).', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB.', 'error');
      e.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    try {
      const upload = await assetService.createImageUploadUrl(imageUploadAssetId, file);
      if (!upload.success) {
        toast(upload.error || 'Failed to prepare image upload', 'error');
        return;
      }

      const uploadResponse = await fetch(upload.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Object storage upload failed');
      }

      const result = await assetService.updateImage(imageUploadAssetId, upload.data.publicUrl);
      if (result.success) {
        setSearchResults(prev => prev.map(asset =>
          asset.id === imageUploadAssetId
            ? { ...asset, imageUrl: upload.data.publicUrl }
            : asset
        ));

        if (activeAsset?.id === imageUploadAssetId) {
          setActiveAsset({ ...activeAsset, imageUrl: upload.data.publicUrl });
        }

        if (trackedAsset?.id === imageUploadAssetId) {
          setTrackedAsset({ ...trackedAsset, imageUrl: upload.data.publicUrl });
        }

        setNotificationMessage('Image uploaded successfully!');
        setNotificationType('success');
        setShowNotification(true);
        onDataChange?.();
      } else {
        toast(result.error || 'Failed to save uploaded image', 'error');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast('Failed to upload image. Please try again.', 'error');
    } finally {
      setIsUploadingImage(false);
      setImageUploadAssetId(null);
      e.target.value = '';
    }
  };

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
  const [transferSubLocation, setTransferSubLocation] = useState('');
  const [transferCustodian, setTransferCustodian] = useState('');
  const [transferCustodianId, setTransferCustodianId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const custodianOptions = users;
  const canInitiate = currentUser && canInitiateTransfer(currentUser.role);
  const canApprove = currentUser && canApproveTransfer(currentUser.role);

  // Update Condition State
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  const [newConditionCode, setNewConditionCode] = useState<ConditionCode>('A1');
  const [isUpdatingCondition, setIsUpdatingCondition] = useState(false);

  // Value Adjustment State
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'Addition' | 'Reduction'>('Addition');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>('');
  const [adjustmentDesc, setAdjustmentDesc] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // Image lightbox (click to open asset image full-screen)
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);

  // Audit State
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [currentAuditSession, setCurrentAuditSession] = useState<AuditSession | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [auditVerifications, setAuditVerifications] = useState<Map<string, AuditVerification>>(new Map());
  const [auditNoteRequest, setAuditNoteRequest] = useState<{ asset: Asset; status: 'Not Found' | 'Damaged'; required: boolean } | null>(null);
  const [auditNoteText, setAuditNoteText] = useState('');
  const [isCompletingAudit, setIsCompletingAudit] = useState(false);

  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Notification State
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('success');
  const [pendingAction, setPendingAction] = useState<'transfer' | 'condition' | null>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotFoundCodeRef = useRef<string | null>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const barcodeScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialAssetId) {
      const asset = assets.find(a => a.id === initialAssetId);
      if (asset) {
        selectAsset(asset);
      }
    } else if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    }
  }, [initialSearchTerm, initialAssetId, assets]);

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

  const submitReport = async () => {
    if (!activeAsset || !currentUser) return;
    setIsSubmittingReport(true);
    try {
      const updateStatus = ['Damage', 'Malfunction'].includes(reportType) ? 'Maintenance' : undefined;
      const result = await assetService.addHistory(
        activeAsset.id,
        {
          action: `Issue Reported: ${reportType}`,
          details: reportDesc,
          type: 'Issue',
          updateStatus
        }
      );
      if (result.success) {
        setIsReportOpen(false);
        setReportDesc('');
        onDataChange?.();
        toast(`Issue reported successfully.${updateStatus ? ` Asset status updated to ${updateStatus}.` : ''}`, 'success');
      } else {
        toast(result.error || 'Failed to save report.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to save report.', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const openTransferModal = (asset: Asset) => {
    setTransferAssetTarget(asset);
    setIsTransferOpen(true);
  };

  const submitTransfer = async () => {
    const target = transferAssetTarget || activeAsset;
    if (!target || !currentUser) return;

    setIsTransferring(true);
    try {
      if (canApprove) {
        // Asset Manager: direct transfer via approve (or initiate+approve in one step)
        if (!transferCustodianId) {
          toast('Please select a custodian.', 'warning');
          setIsTransferring(false);
          return;
        }
        const initResult = await transferService.initiate({
          assetId: target.id,
          toLocation: transferLocation,
          subLocation: transferSubLocation || undefined,
          toCustodian: transferCustodian,
          toCustodianId: transferCustodianId
        });
        if (initResult.success) {
          setIsTransferOpen(false);
          setTransferLocation('');
          setTransferSubLocation('');
          setTransferCustodian('');
          setTransferCustodianId('');
          setTransferAssetTarget(null);
          onDataChange?.();
          toast(`Asset ${target.productId} successfully transferred to ${transferLocation}.`, 'success');
        } else {
          toast(initResult.error || 'Transfer failed.', 'error');
        }
      } else if (canInitiate) {
        // Custodian: initiate transfer request
        if (!transferCustodianId) {
          toast('Please select a custodian.', 'warning');
          setIsTransferring(false);
          return;
        }
        const result = await transferService.initiate({
          assetId: target.id,
          toLocation: transferLocation,
          subLocation: transferSubLocation || undefined,
          toCustodian: transferCustodian,
          toCustodianId: transferCustodianId
        });
        if (result.success) {
          setIsTransferOpen(false);
          setTransferLocation('');
          setTransferSubLocation('');
          setTransferCustodian('');
          setTransferCustodianId('');
          setTransferAssetTarget(null);
          onDataChange?.();
          toast(`Transfer request submitted for ${target.productId}. Awaiting Asset Manager approval.`, 'success');
        } else {
          toast(result.error || 'Failed to initiate transfer.', 'error');
        }
      } else {
        toast('Insufficient permissions.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Transfer failed. Please try again.', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const submitConditionUpdate = async () => {
    if (!activeAsset || !currentUser) return;
    setIsUpdatingCondition(true);
    try {
      const result = await assetService.updateCondition(activeAsset.id, newConditionCode);
      if (result.success) {
        setIsConditionOpen(false);
        onDataChange?.();
        toast(`Condition updated to ${newConditionCode}.`, 'success');
      } else {
        toast(result.error || 'Failed to update condition.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to update condition.', 'error');
    } finally {
      setIsUpdatingCondition(false);
    }
  };

  const handleStartAudit = () => {
    if (!currentUser) {
      setNotificationMessage('User session required to start audit.');
      setNotificationType('error');
      setShowNotification(true);
      return;
    }
    if (!canStartAudit(currentUser.role)) {
      setNotificationMessage('Insufficient permissions. Only Auditors can start audit sessions.');
      setNotificationType('error');
      setShowNotification(true);
      return;
    }

    const safeAssets = Array.isArray(assets) ? assets : [];
    const nextCount = sessionCount + 1;
    setSessionCount(nextCount);
    const sessionId = `AUD-${new Date().getFullYear()}-${String(nextCount).padStart(3, '0')}`;
    const newSession: AuditSession = {
      id: sessionId,
      auditor: currentUser.name,
      auditorId: currentUser.id,
      startDate: new Date().toISOString(),
      status: 'In Progress',
      location: locationFilter !== 'All' ? locationFilter : undefined,
      totalAssets: safeAssets.filter(a => locationFilter === 'All' || a.location === locationFilter).length,
      verifiedAssets: 0,
      notFoundAssets: 0,
    };

    setCurrentAuditSession(newSession);
    setIsAuditMode(true);
    setAuditVerifications(new Map());
    setNotificationMessage(`Audit session ${sessionId} started successfully.`);
    setNotificationType('success');
    setShowNotification(true);
  };

  const handleVerifyAsset = async (asset: Asset, status: 'Verified' | 'Not Found' | 'Damaged', notes?: string) => {
    if (!currentAuditSession || !currentUser) return;

    const verificationId = `VER-${Date.now()}`;
    const verification: AuditVerification = {
      id: verificationId,
      auditSessionId: currentAuditSession.id,
      assetId: asset.id,
      assetProductId: asset.productId,
      assetName: asset.name,
      status,
      verifiedBy: currentUser.name,
      verificationDate: new Date().toISOString(),
      notes,
      locationMatch: true,
      conditionMatch: true,
    };

    const result = await assetService.addHistory(asset.id, {
      action: `Audit Verification: ${status}`,
      details: `Asset verified during audit ${currentAuditSession.id}${notes ? `. Notes: ${notes}` : ''}`,
      type: 'Audit'
    });
    if (!result.success) {
      setNotificationMessage(result.error || 'Failed to persist audit verification.');
      setNotificationType('error');
      setShowNotification(true);
      return;
    }

    const newMap = new Map(auditVerifications);
    newMap.set(asset.id, verification);
    setAuditVerifications(newMap);
    onDataChange?.();

    const verifications = Array.from(newMap.values());
    const updatedSession = {
      ...currentAuditSession,
      verifiedAssets: verifications.filter(v => v.status === 'Verified').length,
      notFoundAssets: verifications.filter(v => v.status === 'Not Found' || v.status === 'Damaged').length,
    };
    setCurrentAuditSession(updatedSession);
  };

  const handleCompleteAudit = () => {
    if (!currentAuditSession) return;

    setIsCompletingAudit(true);
    setTimeout(() => {
      const completedSession: AuditSession = {
        ...currentAuditSession,
        endDate: new Date().toISOString(),
        status: 'Completed'
      };

      const verifiedCount = completedSession.verifiedAssets;
      const notFoundCount = completedSession.notFoundAssets;
      const totalCount = completedSession.totalAssets;
      const pendingCount = totalCount - verifiedCount - notFoundCount;

      setNotificationMessage(
        `Audit ${completedSession.id} completed!\n\n` +
        `Total Assets: ${totalCount}\n` +
        `Verified: ${verifiedCount}\n` +
        `Not Found: ${notFoundCount}\n` +
        `Pending Verification: ${pendingCount}`
      );
      setNotificationType('success');
      setShowNotification(true);

      setIsAuditMode(false);
      setCurrentAuditSession(null);
      setAuditVerifications(new Map());
      setIsCompletingAudit(false);
    }, 1000);
  };

  const toInch = useCallback((v: number, unit: string) =>
    unit === 'inch' ? v : unit === 'mm' ? v / 25.4 : v / 2.54, []);

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
    if (isPrintSettingsOpen && activeAsset) loadPrinters();
  }, [isPrintSettingsOpen, activeAsset, loadPrinters]);

  const getQRWithLogoDataUrl = useCallback(async (text: string, size: number): Promise<string> => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const w = canvas.width;
    const h = canvas.height;
    const logoSize = Math.min(w, h) * 0.22;
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = '/qet-logo-circular.svg';
    });
    if (logoImg.width && logoImg.height) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const x = (w - logoSize) / 2;
        const y = (h - logoSize) / 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, logoSize / 2 + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
      }
    }
    return canvas.toDataURL('image/png');
  }, []);

  useEffect(() => {
    if (!isPrintSettingsOpen || !activeAsset) {
      setPreviewQrUrl('');
      return;
    }
    let cancelled = false;
    getQRWithLogoDataUrl(activeAsset.productId || '', 120)
      .then((url) => { if (!cancelled) setPreviewQrUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPrintSettingsOpen, activeAsset?.productId, getQRWithLogoDataUrl]);

  useEffect(() => {
    if (!isPrintSelectedOpen || selectedAssetIds.size === 0) { setPreviewSelectedQrUrl(''); return; }
    let cancelled = false;
    const firstId = [...selectedAssetIds][0];
    getQRWithLogoDataUrl(firstId, 120).then(url => { if (!cancelled) setPreviewSelectedQrUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isPrintSelectedOpen, selectedAssetIds, getQRWithLogoDataUrl]);

  useEffect(() => {
    if (isPrintSelectedOpen) loadPrinters();
  }, [isPrintSelectedOpen, loadPrinters]);

  useEffect(() => {
    if (!activeAsset?.productId) {
      setPreviewBarcodeUrl('');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, activeAsset.productId, { format: 'CODE128', width: 1.5, height: 28, displayValue: false, margin: 2 });
      setPreviewBarcodeUrl(canvas.toDataURL('image/png'));
    } catch {
      setPreviewBarcodeUrl('');
    }
  }, [activeAsset?.productId]);

  const getBarcodeDataUrl = (text: string, barWidth: number, barHeight: number) => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: barWidth,
      height: barHeight,
      displayValue: false,
      margin: 2,
    });
    return canvas.toDataURL('image/png');
  };

  const handlePrintDirect = async () => {
    if (!activeAsset) return;
    if (!jspmConnected) {
      toast('JSPM Client is not connected. Install and run JSPM from neodynamic.com/downloads/jspm for direct printing.', 'error');
      return;
    }
    setIsPrintingDirect(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { JSPrintManager, ClientPrintJob, DefaultPrinter, InstalledPrinter, PrintFile, FileSourceType } = await import('jsprintmanager');

      const { WSStatus } = await import('jsprintmanager');
      if (JSPrintManager.websocket_status !== WSStatus.Open) {
        toast('JSPM Client is not connected. Please install and run JSPM from neodynamic.com/downloads/jspm', 'error');
        return;
      }

      const s = printSettings;
      const unit = s.units === 'inch' ? 'in' : s.units;
      const wRaw = s.orientation === 'landscape' ? s.height : s.width;
      const hRaw = s.orientation === 'landscape' ? s.width : s.height;
      const wIn = toInch(wRaw, s.units);
      const hIn = toInch(hRaw, s.units);
      const PRINT_DPI = 300;
      const pxW = Math.round(wIn * PRINT_DPI);
      const pxH = Math.round(hIn * PRINT_DPI);

      const qrDataUrl = await getQRWithLogoDataUrl(activeAsset.productId || '', 360);
      const barcodeDataUrl = getBarcodeDataUrl(activeAsset.productId || '', 1.5, Math.round(pxH * 0.12));

      const esc = (x: string) => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const fsH2 = Math.max(8, Math.round(pxH * 0.1));
      const fsV = Math.max(10, Math.round(pxH * 0.14));
      const qrPx = Math.min(pxW, pxH) * 0.5;
      const barcodeH = Math.round(pxH * 0.12);

      const outerDiv = document.createElement('div');
      outerDiv.style.cssText = `width:${pxW}px;height:${pxH}px;overflow:hidden;position:fixed;left:0;top:0;background:#fff;z-index:99999;`;
      const labelDiv = document.createElement('div');
      labelDiv.style.cssText = `width:100%;height:100%;padding:3%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${Math.round(pxH * 0.02)}px;font-family:"Segoe UI",Arial,sans-serif;box-sizing:border-box;`;
      const safeName = esc(activeAsset.name || '');
      labelDiv.innerHTML = `
        <div style="font-size:${fsH2}px;font-weight:700;letter-spacing:0.5px;">${LABEL_OWNER_HTML}</div>
        <div style="width:${qrPx}px;height:${qrPx}px;display:flex;justify-content:center;align-items:center;padding:4px;background:#fff;border:1px solid #ddd;">
          <img src="${qrDataUrl}" alt="QR Code" style="width:100%;height:100%;object-fit:contain;" />
        </div>
        <div style="font-size:${Math.round(fsV * 0.55)}px;font-weight:600;color:#000;line-height:1.2;max-width:100%;min-height:${Math.round(pxH * 0.06)}px;">${safeName || '&nbsp;'}</div>
        <div style="font-size:${fsV}px;font-weight:800;font-family:Consolas,monospace;color:#000;">${esc(activeAsset.productId || '')}</div>
        <div style="height:${barcodeH}px;display:flex;justify-content:center;align-items:center;"><img src="${barcodeDataUrl}" alt="Barcode" style="max-width:100%;height:100%;object-fit:contain;" /></div>
      `;
      outerDiv.appendChild(labelDiv);
      document.body.appendChild(outerDiv);
      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(outerDiv, { width: pxW, height: pxH, scale: 1, useCORS: true, logging: false, allowTaint: true });
      document.body.removeChild(outerDiv);

      let imgData: string;
      if (s.colorMode === 'grayscale') {
        const grayCanvas = document.createElement('canvas');
        grayCanvas.width = canvas.width;
        grayCanvas.height = canvas.height;
        const ctx = grayCanvas.getContext('2d');
        if (ctx) {
          ctx.filter = 'grayscale(100%)';
          ctx.drawImage(canvas, 0, 0);
          imgData = grayCanvas.toDataURL('image/png');
        } else {
          imgData = canvas.toDataURL('image/png');
        }
      } else {
        imgData = canvas.toDataURL('image/png');
      }
      const base64 = imgData.replace(/^data:image\/png;base64,/, '');

      const po = s.orientation === 'landscape' ? 'L' : 'P';
      const fileName = `asset-tag-PX=0-PY=0-PW=${wIn.toFixed(3)}-PH=${hIn.toFixed(3)}-PO=${po}.png`;

      const cpj = new ClientPrintJob();
      cpj.clientPrinter = selectedPrinter ? new InstalledPrinter(selectedPrinter) : new DefaultPrinter();
      cpj.files.push(new PrintFile(base64, FileSourceType.Base64, fileName, 1));
      await cpj.sendToClient();

      setIsPrintSettingsOpen(false);
      setNotificationMessage('Label sent to printer.');
      setNotificationType('success');
      setShowNotification(true);
    } catch (err) {
      console.error('Direct print error:', err);
      toast(err instanceof Error ? err.message : 'Direct print failed. Install JSPM Client from neodynamic.com/downloads/jspm', 'error');
    } finally {
      setIsPrintingDirect(false);
    }
  };

  const handlePrintTag = async (settings?: { units: string; width: number; height: number; orientation: string; colorMode?: string }) => {
    if (!activeAsset) return;
    const s = settings || printSettings;
    const wRaw = s.orientation === 'landscape' ? s.height : s.width;
    const hRaw = s.orientation === 'landscape' ? s.width : s.height;
    const wIn = toInch(wRaw, s.units);
    const hIn = toInch(hRaw, s.units);
    const PRINT_DPI = 300;
    const pxW = Math.round(wIn * PRINT_DPI);
    const pxH = Math.round(hIn * PRINT_DPI);

    const qrDataUrl = await getQRWithLogoDataUrl(activeAsset.productId || '', 360);
    const barcodeDataUrl = getBarcodeDataUrl(activeAsset.productId || '', 1.5, Math.round(pxH * 0.12));
    const esc = (x: string) => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fsH2 = Math.max(8, Math.round(pxH * 0.1));
    const fsV = Math.max(10, Math.round(pxH * 0.14));
    const qrPx = Math.min(pxW, pxH) * 0.5;
    const barcodeH = Math.round(pxH * 0.12);

    const outerDiv = document.createElement('div');
    outerDiv.style.cssText = `width:${pxW}px;height:${pxH}px;overflow:hidden;position:fixed;left:0;top:0;background:#fff;z-index:99999;`;
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `width:100%;height:100%;padding:3%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${Math.round(pxH * 0.02)}px;font-family:"Segoe UI",Arial,sans-serif;box-sizing:border-box;color:#000;`;
    const safeName = esc(activeAsset.name || '');
    labelDiv.innerHTML = `
      <div style="font-size:${fsH2}px;font-weight:700;letter-spacing:0.5px;color:#000;">${LABEL_OWNER_HTML}</div>
      <div style="width:${qrPx}px;height:${qrPx}px;display:flex;justify-content:center;align-items:center;padding:4px;background:#fff;border:1px solid #333;">
        <img src="${qrDataUrl}" alt="QR Code" style="width:100%;height:100%;object-fit:contain;" />
      </div>
      <div style="font-size:${Math.round(fsV * 0.55)}px;font-weight:600;color:#000;line-height:1.2;max-width:100%;min-height:${Math.round(pxH * 0.06)}px;">${safeName || '&nbsp;'}</div>
      <div style="font-size:${fsV}px;font-weight:800;font-family:Consolas,monospace;color:#000;">${esc(activeAsset.productId || '')}</div>
      <div style="height:${barcodeH}px;display:flex;justify-content:center;align-items:center;"><img src="${barcodeDataUrl}" alt="Barcode" style="max-width:100%;height:100%;object-fit:contain;" /></div>
    `;
    outerDiv.appendChild(labelDiv);
    document.body.appendChild(outerDiv);
    await new Promise(r => setTimeout(r, 500));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(outerDiv, { width: pxW, height: pxH, scale: 1, useCORS: true, logging: false, allowTaint: true });
      document.body.removeChild(outerDiv);
      const imgDataUrl = canvas.toDataURL('image/png');

      const printHtml = `<!DOCTYPE html><html><head><title>Asset Tag</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{width:100%;height:100%;min-height:100%;display:flex;align-items:center;justify-content:center;background:#fff}
        img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}
        @media print{
          @page{size:${wIn.toFixed(2)}in ${hIn.toFixed(2)}in;margin:0}
          html,body{width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#fff!important}
          img{max-width:100%!important;max-height:100%!important;margin:auto!important}
        }
      </style></head><body><img src="${imgDataUrl}" alt="Asset Tag" /></body></html>`;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
      const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iDoc) {
        iDoc.open(); iDoc.write(printHtml); iDoc.close();
        const img = iDoc.querySelector('img') as HTMLImageElement | null;
        const doPrint = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 2500);
        };
        if (img) {
          if (img.complete) setTimeout(doPrint, 300);
          else img.onload = () => setTimeout(doPrint, 300);
        } else {
          setTimeout(doPrint, 600);
        }
      }
    } catch (err) {
      document.body.removeChild(outerDiv);
      console.error('Print error:', err);
      toast('Print failed. Please try again.', 'error');
    }
  };

  const handlePrintSelectedTags = async (settings?: typeof printSettings) => {
    const s = settings || printSettings;
    const selectedAssets = assets.filter(a => selectedAssetIds.has(a.productId));
    if (selectedAssets.length === 0) return;
    setIsPrintingSelected(true);
    const wRaw = s.orientation === 'landscape' ? s.height : s.width;
    const hRaw = s.orientation === 'landscape' ? s.width : s.height;
    const wIn = toInch(wRaw, s.units);
    const hIn = toInch(hRaw, s.units);
    const PRINT_DPI = 203;
    const pxW = Math.round(wIn * PRINT_DPI);
    const pxH = Math.round(hIn * PRINT_DPI);
    const esc = (x: string) => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const labelData = await Promise.all(selectedAssets.map(async (asset) => {
      const qrUrl = await getQRWithLogoDataUrl(asset.productId || '', 200);
      const barcodeUrl = getBarcodeDataUrl(asset.productId || '', 1.5, Math.round(pxH * 0.12));
      return { asset, qrUrl, barcodeUrl };
    }));
    const fsH2 = Math.max(6, Math.round(pxH * 0.1));
    const fsV = Math.max(8, Math.round(pxH * 0.14));
    const qrPx = Math.min(pxW, pxH) * 0.5;
    const barcodeH = Math.round(pxH * 0.12);
    const labelsHtml = labelData.map(({ asset, qrUrl, barcodeUrl }) => `
      <div style="width:${pxW}px;height:${pxH}px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${Math.round(pxH * 0.02)}px;font-family:'Segoe UI',Arial,sans-serif;box-sizing:border-box;color:#000;padding:3%;border:1px solid #ccc;break-inside:avoid;page-break-inside:avoid;">
        <div style="font-size:${fsH2}px;font-weight:700;letter-spacing:0.5px;">${LABEL_OWNER_HTML}</div>
        <div style="width:${qrPx}px;height:${qrPx}px;display:flex;justify-content:center;align-items:center;padding:4px;background:#fff;border:1px solid #333;">
          <img src="${qrUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;" />
        </div>
        <div style="font-size:${Math.round(fsV * 0.55)}px;font-weight:600;line-height:1.2;max-width:100%;min-height:${Math.round(pxH * 0.06)}px;">${esc(asset.name || '')}</div>
        <div style="font-size:${fsV}px;font-weight:800;font-family:Consolas,monospace;">${esc(asset.productId || '')}</div>
        ${barcodeUrl ? `<div style="height:${barcodeH}px;display:flex;justify-content:center;align-items:center;"><img src="${barcodeUrl}" alt="Barcode" style="max-width:100%;height:100%;object-fit:contain;" /></div>` : ''}
      </div>`).join('');
    const printHtml = `<!DOCTYPE html><html><head><title>Print Selected Tags</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.grid{display:flex;flex-wrap:wrap;gap:6px;padding:8px;}@media print{@page{size:${wIn}in ${hIn}in;margin:0}.grid{gap:0;padding:0;}}</style></head><body><div class="grid">${labelsHtml}</div></body></html>`;
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
    setIsPrintingSelected(false);
  };

  const handlePrintSelectedDirect = async () => {
    const selectedAssets = assets.filter(a => selectedAssetIds.has(a.productId));
    if (selectedAssets.length === 0) return;
    if (!jspmConnected) { toast('JSPM Client is not connected. Install and run JSPM from neodynamic.com/downloads/jspm', 'error'); return; }
    setIsPrintingSelected(true);
    setPrintBatchProgress('');
    setIsPrintSelectedOpen(false);
    try {
      const { JSPrintManager, ClientPrintJob, InstalledPrinter, DefaultPrinter, PrintFile, FileSourceType, WSStatus } = await import('jsprintmanager');
      if (JSPrintManager.websocket_status !== WSStatus.Open) { toast('JSPM Client is not connected.', 'error'); return; }
      const s = printSettings;
      const wRaw = s.orientation === 'landscape' ? s.height : s.width;
      const hRaw = s.orientation === 'landscape' ? s.width : s.height;
      const wIn = toInch(wRaw, s.units);
      const hIn = toInch(hRaw, s.units);
      const PRINT_DPI = 203;
      const pxW = Math.round(wIn * PRINT_DPI);
      const pxH = Math.round(hIn * PRINT_DPI);
      const po = s.orientation === 'landscape' ? 'L' : 'P';
      const printerSpec = `PX=0-PY=0-PW=${wIn.toFixed(3)}-PH=${hIn.toFixed(3)}-PO=${po}`;
      const total = selectedAssets.length;
      const GEN_BATCH = 50;

      const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
        const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
      });

      const renderLabel = async (asset: Asset): Promise<string> => {
        const qrDataUrl = await getQRWithLogoDataUrl(asset.productId || '', 300);
        const barcodeDataUrl = getBarcodeDataUrl(asset.productId || '', 1.2, Math.round(pxH * 0.12));
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
        ctx.fillText(LABEL_OWNER, pxW / 2, y); y += fsH2 + gap;
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
        setPrintBatchProgress(`Generating ${Math.min(start + GEN_BATCH, total)} of ${total}...`);
        const batch = selectedAssets.slice(start, start + GEN_BATCH);
        const rendered = await Promise.all(batch.map(renderLabel));
        allBase64.push(...rendered);
      }

      // Phase 2: send each label as its own job (PNG — no extra software needed)
      for (let i = 0; i < allBase64.length; i++) {
        setPrintBatchProgress(`Sending ${i + 1} of ${total} to printer...`);
        const cpj = new ClientPrintJob();
        cpj.clientPrinter = selectedPrinter ? new InstalledPrinter(selectedPrinter) : new DefaultPrinter();
        cpj.files.push(new PrintFile(allBase64[i], FileSourceType.Base64, `label-${printerSpec}.png`, 1));
        await cpj.sendToClient();
      }
      setPrintBatchProgress('');
    } catch (err) {
      console.error('Direct print selected error:', err);
      setPrintBatchProgress('');
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      toast('Direct print error: ' + msg, 'error');
    } finally {
      setIsPrintingSelected(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setTrackedAsset(null); // Clear tracking when standard search is used
    const results = assets.filter(a => {
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

  const normalizeForMatch = (s: string) => (s || '').replace(/[\s\-_]/g, '').toLowerCase();

  const scrollToAssetDetail = () => {
    setTimeout(() => {
      document.querySelector('[data-asset-detail]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const lookupAssetById = (id: string) => {
    const trimmed = id.replace(/[\r\n\t]/g, '').trim();
    if (!trimmed) return;
    const norm = normalizeForMatch(trimmed);
    const asset = assets.find(a => {
      const pid = (a.productId || '').toLowerCase();
      const pidNorm = normalizeForMatch(a.productId || '');
      return (
        pid === trimmed.toLowerCase() ||
        pidNorm === norm ||
        pid.includes(trimmed.toLowerCase()) ||
        pidNorm.includes(norm) ||
        a.id === trimmed
      );
    });
    setTrackedAsset(asset || null);
    if (asset) {
      selectAsset(asset, true);
      setTrackingId('');
      setNotificationMessage(`Found: ${asset.productId}`);
      setNotificationType('success');
      setShowNotification(true);
      scrollToAssetDetail();
    } else {
      setNotificationMessage("Asset ID not found.");
      setNotificationType('error');
      setShowNotification(true);
    }
  };

  const handleTrackAsset = () => lookupAssetById(trackingId);

  const startBarcodeGunScan = () => {
    setIsBarcodeGunReady(true);
    setTimeout(() => {
      trackingInputRef.current?.focus();
      setNotificationMessage('Ready to scan. Point your barcode gun at the field and scan.');
      setNotificationType('info');
      setShowNotification(true);
    }, 50);
    setTimeout(() => setIsBarcodeGunReady(false), 5000);
  };

  const handleTrackingInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTrackingId(val);
    if (barcodeScanTimeoutRef.current) clearTimeout(barcodeScanTimeoutRef.current);
    if (val.length >= 4) {
      barcodeScanTimeoutRef.current = setTimeout(() => {
        if (val.trim()) lookupAssetById(val);
      }, 200);
    }
  };

  const selectAsset = (asset: Asset, keepTracked?: boolean) => {
    setActiveAsset(asset);
    setSearchResults([]);
    setSearchTerm('');
    if (!keepTracked) setTrackedAsset(null);

    // Handle pending actions
    if (pendingAction === 'transfer') {
      setIsTransferOpen(true);
      setTransferAssetTarget(asset);
      setPendingAction(null);
    } else if (pendingAction === 'condition') {
      setIsConditionOpen(true);
      setPendingAction(null);
    }
  };

  const decodeFromVideoFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try QR code first (jsQR - sync)
    const qrResult = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    if (qrResult?.data) return qrResult.data.trim();

    // Try BarcodeDetector API for barcodes (Chrome, Edge, Safari 16.4+)
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (typeof BarcodeDetector === 'function') {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
        const bitmap = await createImageBitmap(imageData);
        const barcodes = await detector.detect(bitmap);
        bitmap.close();
        if (barcodes.length > 0 && barcodes[0].rawValue) return barcodes[0].rawValue.trim();
      } catch {
        // ignore
      }
    }
    return null;
  }, []);

  const decodeFromImageData = useCallback(async (imageData: ImageData): Promise<string | null> => {
    const qrResult = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    if (qrResult?.data) return qrResult.data.trim();

    const BarcodeDetector = (window as any).BarcodeDetector;
    if (typeof BarcodeDetector === 'function') {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
        const bitmap = await createImageBitmap(imageData);
        const barcodes = await detector.detect(bitmap);
        bitmap.close();
        if (barcodes.length > 0 && barcodes[0].rawValue) return barcodes[0].rawValue.trim();
      } catch {
        // ignore
      }
    }
    return null;
  }, []);

  const findAssetByCode = useCallback((code: string): Asset | null => {
    const trimmed = (code || '').replace(/[\r\n\t]/g, '').trim();
    if (!trimmed) return null;
    const norm = normalizeForMatch(trimmed);
    const tryMatch = (scanned: string, scannedNorm: string) =>
      assets.find((a) => {
        const pid = (a.productId || '').toLowerCase();
        const pidNorm = normalizeForMatch(a.productId || '');
        return pid === scanned.toLowerCase() || pidNorm === scannedNorm || pid.includes(scanned.toLowerCase()) || pidNorm.includes(scannedNorm) || a.id === scanned;
      }) || null;
    let asset = tryMatch(trimmed, norm);
    if (!asset && /^\d$/.test(trimmed.slice(-1))) {
      asset = tryMatch(trimmed.slice(0, -1), normalizeForMatch(trimmed.slice(0, -1)));
    }
    return asset;
  }, [assets]);

  const startCamera = async (deviceIdOverride?: string) => {
    setIsCameraOpen(true);

    type GetUserMediaFn = (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    const getMedia = (): GetUserMediaFn | null => {
      if (navigator.mediaDevices?.getUserMedia) {
        return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      }
      const nav = navigator as any;
      const legacy = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;
      if (legacy) {
        return (constraints: MediaStreamConstraints) =>
          new Promise<MediaStream>((resolve, reject) =>
            legacy.call(navigator, constraints, resolve, reject)
          );
      }
      return null;
    };

    const getUserMediaFn = getMedia();
    if (!getUserMediaFn) {
      const isInsecure = typeof window !== 'undefined' && !window.isSecureContext;
      setNotificationMessage(
        isInsecure
          ? "Camera requires HTTPS. Use https://... instead of http://, or run: npm run dev:https"
          : "Camera not supported. Try a modern browser (Chrome, Safari, Firefox) or use Upload Photo."
      );
      setNotificationType('error');
      setShowNotification(true);
      setIsCameraOpen(false);
      return;
    }

    try {
      let deviceId = deviceIdOverride || selectedDeviceId;
      // Enumerate video devices (cameras + scanners that appear as videoinput)
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0) {
          if (!deviceId || !videoInputs.some((d) => d.deviceId === deviceId)) {
            deviceId = videoInputs[0].deviceId;
            setSelectedDeviceId(deviceId);
          }
        }
      }
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'environment' as const, width: { ideal: 1280 }, height: { ideal: 720 } };

      let stream: MediaStream;
      try {
        stream = await getUserMediaFn({ video: videoConstraints });
      } catch {
        try {
          stream = await getUserMediaFn({ video: deviceId ? { deviceId: { exact: deviceId } } : true });
        } catch {
          stream = await getUserMediaFn({ video: true });
        }
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Re-enumerate after permission granted to get device labels (scanner names)
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
      }
      lastNotFoundCodeRef.current = null;
      const runScanLoop = async () => {
        if (!streamRef.current) return;
        const code = await decodeFromVideoFrame();
        if (code) {
          const asset = findAssetByCode(code);
          if (asset) {
            if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current);
            stopCamera();
            setTrackedAsset(asset);
            selectAsset(asset, true);
            setNotificationMessage(`Scanned: ${asset.productId}`);
            setNotificationType('success');
            setShowNotification(true);
            scrollToAssetDetail();
            return;
          }
          if (lastNotFoundCodeRef.current !== code) {
            lastNotFoundCodeRef.current = code;
            setNotificationMessage(`Code "${code}" not found in asset register.`);
            setNotificationType('info');
            setShowNotification(true);
          }
        }
        if (streamRef.current) {
          scanIntervalRef.current = setTimeout(runScanLoop, 300);
        }
      };
      runScanLoop();
    } catch (err: any) {
      console.error("Camera Error:", err);
      const isInsecure = typeof window !== 'undefined' && !window.isSecureContext;
      const name = err?.name || err?.code || '';
      let msg = "Could not access camera. ";
      if (isInsecure || name === 'NotAllowedError' || name === 'NotSupportedError') {
        msg = "Camera requires HTTPS. Use https://... or run: npm run dev:https";
      } else if (name === 'PermissionDeniedError' || name === 'NotAllowedError') {
        msg = "Camera permission denied. Allow camera access in your browser settings.";
      } else if (name === 'NotFoundError') {
        msg = "No camera found on this device.";
      }
      setNotificationMessage(msg);
      setNotificationType('error');
      setShowNotification(true);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    setIsCameraOpen(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearTimeout(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearTimeout(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, []);

  const switchScanDevice = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearTimeout(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    await startCamera(newDeviceId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewImage(dataUrl);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setNotificationMessage("Could not process image.");
          setNotificationType('error');
          setShowNotification(true);
          setIsAnalyzing(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = await decodeFromImageData(imageData);
        if (code) {
          const asset = findAssetByCode(code);
          if (asset) {
            setTrackedAsset(asset);
            selectAsset(asset, true);
            setNotificationMessage(`Scanned: ${asset.productId}`);
            setNotificationType('success');
            setShowNotification(true);
            scrollToAssetDetail();
          } else {
            setNotificationMessage(`Code "${code}" not found in asset register.`);
            setNotificationType('info');
            setShowNotification(true);
          }
        } else {
          setNotificationMessage("No barcode or QR code found in image.");
          setNotificationType('info');
          setShowNotification(true);
        }
      } catch {
        setNotificationMessage("Could not decode image.");
        setNotificationType('error');
        setShowNotification(true);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      setNotificationMessage("Camera not ready. Please wait a moment.");
      setNotificationType('info');
      setShowNotification(true);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setPreviewImage(canvas.toDataURL('image/png'));
    stopCamera();

    const code = await decodeFromImageData(imageData);
    if (code) {
      const asset = findAssetByCode(code);
      if (asset) {
        setTrackedAsset(asset);
        selectAsset(asset, true);
        setNotificationMessage(`Scanned: ${asset.productId}`);
        setNotificationType('success');
        setShowNotification(true);
        scrollToAssetDetail();
      } else {
        setNotificationMessage(`Code "${code}" not found in asset register.`);
        setNotificationType('info');
        setShowNotification(true);
      }
    } else {
      setNotificationMessage("No barcode or QR code detected. Try again or enter manually.");
      setNotificationType('info');
      setShowNotification(true);
    }
  };

  const submitValueAdjustment = async () => {
    if (!activeAsset || !adjustmentAmount || !currentUser) return;
    setIsSubmittingAdjustment(true);
    try {
      const amount = Number(adjustmentAmount);
      const result = await assetService.addImprovement(
        activeAsset.id,
        {
          type: adjustmentType,
          amount,
          description: adjustmentDesc || `${adjustmentType} of ₦${amount.toLocaleString()}`,
          date: adjustmentDate
        }
      );
      if (result.success) {
        setIsAdjustmentOpen(false);
        setAdjustmentAmount('');
        setAdjustmentDesc('');
        onDataChange?.();
        setNotificationMessage(`Asset value updated successfully.`);
        setNotificationType('success');
        setShowNotification(true);
      } else {
        toast(result.error || 'Failed to update value.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to update value.', 'error');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const exportToCSV = useCallback(() => {
    const headers = ["Asset Tag", "Asset Name", "Category", "Asset Type", "Acquisition Cost", "Acquisition Date", "Registration Date", "Location", "Department", "Custodian", "Assigned User", "Condition", "Status"];
    const rows = assets.map(asset => [
      asset.productId,
      asset.name,
      asset.category,
      asset.subCategory || '-',
      String(asset.acquisitionCost),
      asset.acquisitionDate,
      asset.registrationDate || '-',
      asset.location,
      asset.subLocation || '-',
      asset.custodian,
      asset.assignedUser || '-',
      asset.conditionCode || '-',
      asset.status
    ]);
    downloadCsv(`QET_Asset_Inventory_${new Date().toISOString().split('T')[0]}.csv`, arraysToCsv([headers, ...rows]));
    setNotificationMessage("CSV exported successfully");
    setNotificationType('success');
    setShowNotification(true);
    setShowExportOptions(false);
  }, [assets, setNotificationMessage, setNotificationType, setShowNotification, setShowExportOptions]);

  const exportToExcel = useCallback(() => {
    const data = assets.map(asset => ({
      "Asset Tag": asset.productId,
      "Asset Name": asset.name,
      "Category": asset.category,
      "Asset Type": asset.subCategory || '-',
      "Acquisition Cost": asset.acquisitionCost,
      "Acquisition Date": asset.acquisitionDate,
      "Registration Date": asset.registrationDate || '-',
      "Location": asset.location,
      "Department": asset.subLocation || '-',
      "Custodian": asset.custodian,
      "Assigned User": asset.assignedUser || '-',
      "Condition": asset.conditionCode || '-',
      "Status": asset.status
    }));

    downloadCsv(`QET_Asset_Inventory_${new Date().toISOString().split('T')[0]}.csv`, rowsToCsv(data));

    setNotificationMessage("CSV exported successfully");
    setNotificationType('success');
    setShowNotification(true);
    setShowExportOptions(false);
  }, [setNotificationMessage, setNotificationType, setShowNotification, setShowExportOptions]);

  const exportToPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // Header
      doc.setFillColor(31, 82, 152);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('QET Asset Inventory Report', 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${dateStr}  |  Total Assets: ${assets.length}`, 14, 17);

      const columns = [
        { header: '#', dataKey: 'no' },
        { header: 'Asset Tag', dataKey: 'tag' },
        { header: 'Asset Name', dataKey: 'name' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Location', dataKey: 'location' },
        { header: 'Custodian', dataKey: 'custodian' },
        { header: 'Acq. Cost (₦)', dataKey: 'cost' },
        { header: 'Acq. Date', dataKey: 'date' },
        { header: 'Condition', dataKey: 'condition' },
        { header: 'Status', dataKey: 'status' },
      ];

      const rows = assets.map((a, i) => ({
        no: i + 1,
        tag: a.productId,
        name: a.name,
        category: a.category,
        location: a.location,
        custodian: a.custodian,
        cost: Number(a.acquisitionCost || 0).toLocaleString('en-NG'),
        date: a.acquisitionDate || '-',
        condition: a.conditionCode || '-',
        status: a.status,
      }));

      autoTable(doc, {
        startY: 26,
        columns,
        body: rows,
        styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: [31, 82, 152], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        columnStyles: {
          no: { cellWidth: 8, halign: 'center' },
          tag: { cellWidth: 32, fontStyle: 'bold' },
          name: { cellWidth: 48 },
          category: { cellWidth: 28 },
          location: { cellWidth: 28 },
          custodian: { cellWidth: 28 },
          cost: { cellWidth: 26, halign: 'right' },
          date: { cellWidth: 22, halign: 'center' },
          condition: { cellWidth: 18, halign: 'center' },
          status: { cellWidth: 22, halign: 'center' },
        },
        didDrawCell: (data) => {
          if (data.column.dataKey === 'status' && data.cell.section === 'body') {
            const status = String(data.cell.raw || '');
            if (status === 'Active') {
              doc.setFillColor(220, 252, 231);
              doc.roundedRect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 1, 1, 'F');
              doc.setTextColor(22, 101, 52);
            } else if (status === 'Disposed') {
              doc.setFillColor(254, 226, 226);
              doc.roundedRect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 1, 1, 'F');
              doc.setTextColor(153, 27, 27);
            } else if (status === 'Maintenance') {
              doc.setFillColor(254, 243, 199);
              doc.roundedRect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 1, 1, 'F');
              doc.setTextColor(120, 53, 15);
            }
            doc.setFontSize(7.5);
            doc.text(status, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 0.5, { align: 'center', baseline: 'middle' });
            doc.setTextColor(0, 0, 0);
          }
        },
        // Footer with page numbers
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}  |  QET Asset Management System`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 5
          );
        },
      });

      doc.save(`QET_Asset_Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
      setNotificationMessage(`PDF exported — ${assets.length} assets`);
      setNotificationType('success');
      setShowNotification(true);
      setShowExportOptions(false);
    } catch (err) {
      console.error('PDF export error:', err);
      setNotificationMessage('PDF export failed');
      setNotificationType('error');
      setShowNotification(true);
    }
  }, [assets, setNotificationMessage, setNotificationType, setShowNotification, setShowExportOptions]);

  const priorityAssets = assets.filter(a =>
    ['Maintenance', 'Disposed'].includes(a.status) ||
    (a.conditionCode && ['F1', 'F2', 'F3', 'A4'].includes(a.conditionCode))
  );

  const assetHistory = activeAsset
    ? (activeAsset.history || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {onBack && !isViewAllOpen && (
        <button
          onClick={() => {
            if (activeAsset) {
              setActiveAsset(null);
              setSearchResults([]);
            } else {
              onBack();
            }
          }}
          className="flex items-center text-sm text-slate-500 hover:text-qet-600 mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          {activeAsset ? 'Back to Search' : 'Back to Dashboard'}
        </button>
      )}

      {isViewAllOpen ? (
        <AssetListView
          onClose={() => setIsViewAllOpen(false)}
          onExportCSV={exportToCSV}
          onExportExcel={exportToExcel}
          onExportPDF={exportToPDF}
          onSelectAsset={(asset) => {
            selectAsset(asset);
            setIsViewAllOpen(false);
          }}
          showExportOptions={showExportOptions}
          setShowExportOptions={setShowExportOptions}
          assets={assets}
          selectedIds={selectedAssetIds}
          onToggleSelect={(productId) => setSelectedAssetIds(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId); else next.add(productId);
            return next;
          })}
          onSelectAll={() => setSelectedAssetIds(new Set(assets.map(a => a.productId)))}
          onClearAll={() => setSelectedAssetIds(new Set())}
          onPrintSelected={() => setIsPrintSelectedOpen(true)}
          onPrintAll={() => { setSelectedAssetIds(new Set(assets.map(a => a.productId))); setIsPrintSelectedOpen(true); }}
        />
      ) : (
        <>
          {/* Header Area */}
          <div className={`bg-white p-6 rounded-xl shadow-sm border mb-6 space-y-4 ${managementMode ? 'border-qet-200 bg-qet-50' : 'border-slate-100'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-4 text-qet-800">
                <img
                  src="/qet-logo-transparent.svg"
                  alt="QET Logo"
                  className="h-12 w-auto object-contain"
                />
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
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-qet-500 outline-none text-slate-700"
                />
              </div>

              {/* Track Asset Field - Only in Lookup Mode */}
              {!managementMode && (
                <div className={`relative w-full md:w-64 transition-all ${isBarcodeGunReady ? 'ring-2 ring-accent-500 ring-offset-2 rounded-xl' : ''}`}>
                  <LocateFixed className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent-600" size={18} />
                  <input
                    ref={trackingInputRef}
                    type="text"
                    value={trackingId}
                    onChange={handleTrackingInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrackAsset()}
                    placeholder="Scan barcode or type Asset ID..."
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
                  className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-qet-500 outline-none text-slate-700 appearance-none text-sm"
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
                  className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-qet-500 outline-none text-slate-700 appearance-none text-sm"
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
              <div className="grid grid-cols-3 gap-4 pt-2">
                <button
                  onClick={startBarcodeGunScan}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-accent-200 rounded-xl text-accent-700 hover:bg-accent-50 transition-colors shadow-sm"
                >
                  <Scan size={24} className="mb-2" />
                  <span className="text-sm font-semibold">Scan with Barcode Gun</span>
                  <span className="text-[10px] text-slate-500 mt-1">USB / Bluetooth scanner</span>
                </button>
                <button
                  onClick={() => startCamera()}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-qet-200 rounded-xl text-qet-700 hover:bg-qet-50 transition-colors shadow-sm"
                >
                  <Camera size={24} className="mb-2" />
                  <span className="text-sm font-semibold">Scan Barcode / QR</span>
                  <span className="text-[10px] text-slate-500 mt-1">Camera / document scanner</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ImageIcon size={24} className="mb-2" />
                  <span className="text-sm font-semibold">Upload Photo</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
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
                <button onClick={() => selectAsset(trackedAsset)} className="text-sm text-qet-600 hover:underline">View Details</button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Current Location</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1"><MapPin size={14} /> {trackedAsset.location}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Custodian</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1"><User size={14} /> {trackedAsset.custodian}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => {
                      setPendingAction('transfer');
                      setIsViewAllOpen(true);
                    }}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-qet-500 hover:shadow-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-qet-100 rounded-full flex items-center justify-center text-qet-600 mb-3 group-hover:bg-qet-600 group-hover:text-white transition-colors">
                      <ArrowRightLeft size={20} />
                    </div>
                    <h4 className="font-bold text-slate-800">Transfer Asset</h4>
                    <p className="text-xs text-slate-500 mt-1">Move items between branches.</p>
                  </button>
                  <button
                    onClick={() => {
                      setPendingAction('condition');
                      setIsViewAllOpen(true);
                    }}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Activity size={20} />
                    </div>
                    <h4 className="font-bold text-slate-800">Update Condition</h4>
                    <p className="text-xs text-slate-500 mt-1">Log damage or repairs.</p>
                  </button>
                  {currentUser && canStartAudit(currentUser.role) && (
                    <button onClick={handleStartAudit} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left group">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <CheckCircle2 size={20} />
                      </div>
                      <h4 className="font-bold text-slate-800">Start Audit</h4>
                      <p className="text-xs text-slate-500 mt-1">Verify physical inventory.</p>
                    </button>
                  )}
                  <button onClick={() => setIsViewAllOpen(true)} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-qet-500 hover:shadow-md transition-all text-left group">
                    <div className="w-10 h-10 bg-qet-100 rounded-full flex items-center justify-center text-qet-600 mb-3 group-hover:bg-qet-600 group-hover:text-white transition-colors">
                      <Table size={20} />
                    </div>
                    <h4 className="font-bold text-slate-800">View All Assets</h4>
                    <p className="text-xs text-slate-500 mt-1">Full inventory list & export.</p>
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
                              <button onClick={() => selectAsset(asset)} className="text-qet-600 hover:text-qet-800 font-medium text-xs border border-qet-200 px-3 py-1 rounded hover:bg-qet-50">Manage</button>
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

          {/* AUDIT MODE INTERFACE */}
          {isAuditMode && currentAuditSession && !activeAsset && (
            <div className="animate-fadeIn space-y-6">
              {/* Audit Session Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Activity size={24} /> Audit in Progress
                    </h3>
                    <p className="text-blue-100 text-sm mt-1">Session: {currentAuditSession.id}</p>
                    <p className="text-blue-100 text-sm">Auditor: {currentAuditSession.auditor}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{currentAuditSession.verifiedAssets}/{currentAuditSession.totalAssets}</div>
                    <div className="text-blue-100 text-sm">Assets Verified</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                    <p className="text-xs text-blue-100">Verified</p>
                    <p className="text-lg font-bold">{currentAuditSession.verifiedAssets}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                    <p className="text-xs text-blue-100">Not Found</p>
                    <p className="text-lg font-bold">{currentAuditSession.notFoundAssets}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                    <p className="text-xs text-blue-100">Pending</p>
                    <p className="text-lg font-bold">{currentAuditSession.totalAssets - currentAuditSession.verifiedAssets - currentAuditSession.notFoundAssets}</p>
                  </div>
                </div>
              </div>

              {/* Assets to Verify List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Assets to Verify</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsAuditMode(false); setCurrentAuditSession(null); setAuditVerifications(new Map()); }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium"
                    >
                      Cancel Audit
                    </button>
                    <button
                      onClick={handleCompleteAudit}
                      disabled={isCompletingAudit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-md flex items-center gap-2"
                    >
                      {isCompletingAudit && <Loader2 size={16} className="animate-spin" />}
                      Complete Audit
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {assets
                    .filter(a => !currentAuditSession.location || a.location === currentAuditSession.location)
                    .map(asset => {
                      const verification = auditVerifications.get(asset.id);
                      const isVerified = verification?.status === 'Verified';
                      const isNotFound = verification?.status === 'Not Found';
                      const isDamaged = verification?.status === 'Damaged';

                      return (
                        <div key={asset.id} className={`bg-white p-4 rounded-xl shadow-sm border-2 transition-all ${isVerified ? 'border-green-300 bg-green-50' :
                          isNotFound ? 'border-red-300 bg-red-50' :
                            isDamaged ? 'border-amber-300 bg-amber-50' :
                              'border-slate-200'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {asset.imageUrl ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setImageLightboxUrl(asset.imageUrl!); }} className="flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 focus:ring-2 focus:ring-qet-500" title="Click to open image">
                                  <img src={asset.imageUrl} alt={asset.name} className="w-12 h-12 object-cover hover:opacity-90 transition-opacity" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleImageUploadClick(e, asset.id)}
                                  className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-400 transition-colors cursor-pointer border-2 border-dashed border-slate-300 hover:border-qet-500 group"
                                  title="Click to upload image"
                                  disabled={isUploadingImage && imageUploadAssetId === asset.id}
                                >
                                  {isUploadingImage && imageUploadAssetId === asset.id ? (
                                    <Loader2 size={16} className="animate-spin text-qet-600" />
                                  ) : (
                                    <ImageIcon size={16} className="text-slate-500 group-hover:text-qet-600" />
                                  )}
                                </button>
                              )}
                              <div>
                                <h4 className="font-bold text-slate-800">{asset.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-500 font-mono">{asset.productId}</span>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <MapPin size={10} /> {asset.location}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {verification ? (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isVerified ? 'bg-green-100 text-green-700' :
                                  isNotFound ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                  <CheckCircle2 size={12} />
                                  {verification.status}
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleVerifyAsset(asset, 'Verified')}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold"
                                  >
                                    ✓ Verified
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAuditNoteRequest({ asset, status: 'Not Found', required: false });
                                      setAuditNoteText('');
                                    }}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold"
                                  >
                                    ✗ Not Found
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAuditNoteRequest({ asset, status: 'Damaged', required: true });
                                      setAuditNoteText('');
                                    }}
                                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold"
                                  >
                                    ⚠ Damaged
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {verification?.notes && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs text-slate-600"><span className="font-semibold">Notes:</span> {verification.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Standard Search Results */}
          {!activeAsset && searchResults.length > 0 && !isAuditMode && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">Search Results ({searchResults.length})</h3>
              {searchResults.map((asset) => (
                <div key={asset.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-qet-300 cursor-pointer transition-all">
                  <div className="flex items-center space-x-4 flex-1" onClick={() => selectAsset(asset)}>
                    {asset.imageUrl ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setImageLightboxUrl(asset.imageUrl!); }} className="flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 focus:ring-2 focus:ring-qet-500" title="Click to open image">
                        <img src={asset.imageUrl} alt={asset.name} className="w-12 h-12 object-cover hover:opacity-90 transition-opacity" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleImageUploadClick(e, asset.id)}
                        className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-400 transition-colors cursor-pointer border-2 border-dashed border-slate-300 hover:border-qet-500 group"
                        title="Click to upload image"
                        disabled={isUploadingImage && imageUploadAssetId === asset.id}
                      >
                        {isUploadingImage && imageUploadAssetId === asset.id ? (
                          <Loader2 size={16} className="animate-spin text-qet-600" />
                        ) : (
                          <ImageIcon size={16} className="text-slate-500 group-hover:text-qet-600" />
                        )}
                      </button>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800">{asset.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{asset.productId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getConditionColor(asset.conditionCode)}`}>{asset.conditionCode}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><MapPin size={10} /> {asset.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {managementMode && (
                      <button onClick={() => openTransferModal(asset)} className="p-2 text-qet-600 hover:bg-qet-50 rounded-lg" title="Quick Transfer">
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
            <div className="space-y-4 animate-slideIn" data-asset-detail>
              <div className="flex justify-between items-center mb-2">
                <button onClick={() => setActiveAsset(null)} className="text-sm text-qet-600 hover:underline">Back to List</button>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-qet-600 relative overflow-hidden">
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
                  {activeAsset.imageUrl ? (
                    <button type="button" onClick={() => setImageLightboxUrl(activeAsset.imageUrl!)} className="block rounded-lg overflow-hidden border border-slate-200 bg-slate-200 focus:ring-2 focus:ring-qet-500 focus:ring-offset-2" title="Click to open image">
                      <img src={activeAsset.imageUrl} alt={activeAsset.name} className="w-24 h-24 object-cover hover:opacity-90 transition-opacity" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleImageUploadClick({ stopPropagation: () => { } } as any, activeAsset.id)}
                      className="w-24 h-24 rounded-lg bg-slate-200 border-2 border-dashed border-slate-300 hover:border-qet-500 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-300 transition-colors cursor-pointer group"
                      title="Click to upload image"
                      disabled={isUploadingImage && imageUploadAssetId === activeAsset.id}
                    >
                      {isUploadingImage && imageUploadAssetId === activeAsset.id ? (
                        <Loader2 size={20} className="animate-spin text-qet-600" />
                      ) : (
                        <>
                          <ImageIcon size={24} className="text-slate-500 group-hover:text-qet-600 mb-1" />
                          <span className="text-[10px] group-hover:text-qet-600">Upload</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Professional Asset Tag - QR left, ID + Barcode + Name right */}
              <div id="asset-tag-print-area" className="w-[260px] min-h-[110px] bg-white border-2 border-slate-900 rounded-lg shadow-xl mx-auto overflow-hidden flex flex-col relative group hover:scale-[1.02] transition-transform duration-300" title="Label: 2.6in × 1.1in (QET stock)">
                {/* Print button */}
                <div className="absolute top-2 right-2 z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsPrintSettingsOpen(true); }}
                    className="p-1.5 rounded-full bg-slate-900 text-white shadow-md hover:bg-slate-700 transition-colors"
                    title="Print Tag"
                  >
                    <Printer size={14} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 p-3">
                  <p className="text-xs font-bold">{LABEL_OWNER}</p>
                  <div id="asset-tag-qr" className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-white p-1 border border-slate-200">
                    <QRCodeSVG
                      value={activeAsset.productId}
                      size={72}
                      level="H"
                      imageSettings={{
                        src: '/qet-logo-circular.svg',
                        height: 20,
                        width: 20,
                        excavate: true,
                      }}
                    />
                  </div>
                  <p className="text-[9px] font-semibold text-slate-800 line-clamp-2 max-w-full">{activeAsset.name}</p>
                  <p className="text-sm font-mono font-bold break-all">{activeAsset.productId}</p>
                  {previewBarcodeUrl && (
                    <div className="h-8 flex items-center justify-center">
                      <img src={previewBarcodeUrl} alt="Barcode" className="max-w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {managementMode ? (
                  <>
                    <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><ArrowRightLeft size={20} className="text-slate-400" /> <span>Transfer</span></button>
                    <button onClick={() => setIsConditionOpen(true)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><Activity size={20} className="text-blue-500" /> <span>Condition</span></button>
                    <button onClick={() => setIsAdjustmentOpen(true)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><TrendingUp size={20} className="text-purple-600" /> <span>Update Value</span></button>
                  </>
                ) : (
                  <button onClick={() => openTransferModal(activeAsset)} className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex flex-col items-center justify-center gap-2 shadow-sm"><ArrowRightLeft size={20} className="text-slate-400" /> <span>Transfer</span></button>
                )}
                <button onClick={() => setIsReportOpen(true)} className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 flex flex-col items-center justify-center gap-2 shadow-sm"><AlertTriangle size={20} className="text-amber-600" /> <span>Report Issue</span></button>
              </div>

              {/* Detailed Tabs */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[300px] mt-6">
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6">
                  <button onClick={() => setActiveTab('overview')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'overview' ? 'bg-white shadow text-qet-700' : 'text-slate-500'}`}>Overview</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'history' ? 'bg-white shadow text-qet-700' : 'text-slate-500'}`}>History</button>
                  <button onClick={() => setActiveTab('transfers')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'transfers' ? 'bg-white shadow text-qet-700' : 'text-slate-500'}`}>Transfers</button>
                  <button onClick={() => setActiveTab('depreciation')} className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${activeTab === 'depreciation' ? 'bg-white shadow text-qet-700' : 'text-slate-500'}`}>Depreciation</button>
                </div>

                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* General Information */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">General Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Identification</p>
                          <div className="space-y-2">
                            <div><span className="text-xs text-slate-400 block">Asset Name</span> <span className="text-sm font-medium text-slate-800">{activeAsset.name}</span></div>
                            <div><span className="text-xs text-slate-400 block">System Generated ID</span> <span className="text-sm font-mono font-bold text-qet-700 bg-qet-50 px-2 py-0.5 rounded inline-block">{activeAsset.productId}</span></div>
                            <div><span className="text-xs text-slate-400 block">Category</span> <span className="text-sm font-medium text-slate-800">{activeAsset.category}</span></div>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status & Condition</p>
                          <div className="space-y-2">
                            <div><span className="text-xs text-slate-400 block">Current Status</span> <span className={`text-xs font-bold px-2 py-0.5 rounded ${activeAsset.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{activeAsset.status}</span></div>
                            <div><span className="text-xs text-slate-400 block">Condition</span> <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getConditionColor(activeAsset.conditionCode)}`}>{activeAsset.conditionCode || 'N/A'} - {CONDITION_DESCRIPTIONS[activeAsset.conditionCode as ConditionCode] || 'Unknown'}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Location & Custody */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Location & Custody</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"><MapPin size={16} /></div>
                            <div>
                              <p className="text-xs text-slate-500 mb-0.5">Physical Location</p>
                              <p className="text-sm font-bold text-slate-800">{activeAsset.location}</p>
                              {activeAsset.subLocation && <p className="text-xs text-slate-600 mt-1 bg-slate-100 px-2 py-0.5 rounded inline-block">{activeAsset.subLocation}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0"><User size={16} /></div>
                            <div>
                              <p className="text-xs text-slate-500 mb-0.5">Custodian</p>
                              <p className="text-sm font-bold text-slate-800">{activeAsset.custodian}</p>
                              {activeAsset.assignedUser && <p className="text-xs text-slate-500 mt-1">Assigned To: {activeAsset.assignedUser}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Details - Only visible in Management Mode */}
                    {managementMode && (
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Financial Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 border rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">Acquisition Cost</p>
                            <p className="text-sm font-bold text-slate-800">₦{activeAsset.acquisitionCost.toLocaleString()}</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">Net Book Value</p>
                            <p className="text-sm font-bold text-qet-700">₦{activeAsset.netBookValue.toLocaleString()}</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">Purchase Date</p>
                            <p className="text-sm font-medium text-slate-800">{activeAsset.acquisitionDate}</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">Useful Life</p>
                            <p className="text-sm font-medium text-slate-800">{activeAsset.usefulLife ? `${activeAsset.usefulLife} Years` : 'N/A'}</p>
                          </div>
                          {activeAsset.lastImprovementDate && (
                            <div className="p-3 border rounded-lg bg-purple-50 border-purple-100">
                              <p className="text-xs text-purple-600 mb-1">Last Value Update</p>
                              <p className="text-sm font-bold text-slate-800">{activeAsset.lastImprovementDate}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
                }

                {
                  activeTab === 'history' && (
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
                  )
                }

                {
                  activeTab === 'transfers' && (
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
                                <td className="p-3 font-medium text-qet-700 flex items-center gap-1"><ArrowRightLeft size={12} /> {h.toLocation || '-'}</td>
                                <td className="p-3 text-slate-600">{h.toCustodian || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">No transfer history.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                {
                  activeTab === 'depreciation' && (
                    <div className="space-y-8 animate-fadeIn">
                      {/* Calculation Logic Wrapper */}
                      <DepreciationView activeAsset={activeAsset} />
                    </div>
                  )
                }
              </div >
            </div >
          )}

          {/* Modals */}
          {isPrintSettingsOpen && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Printer size={20} className="text-slate-600" /> Print Settings
                  </h3>
                  <button onClick={() => setIsPrintSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
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
                        <p className="text-xs text-slate-500">Install JSPM Client to select printers in the app. <a href="https://neodynamic.com/downloads/jspm" target="_blank" rel="noopener noreferrer" className="text-qet-600 hover:underline">Download</a></p>
                        <button
                          type="button"
                          onClick={loadPrinters}
                          disabled={isLoadingPrinters}
                          className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isLoadingPrinters ? <Loader2 size={12} className="animate-spin" /> : null}
                          Load printers
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Label preview</label>
                    <div
                      className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm mx-auto"
                      style={(() => {
                        const aspect = printSettings.orientation === 'landscape'
                          ? printSettings.height / printSettings.width
                          : printSettings.width / printSettings.height;
                        const maxW = 220;
                        const maxH = 140;
                        const w = aspect >= maxW / maxH ? maxW : maxH * aspect;
                        const h = aspect >= maxW / maxH ? maxW / aspect : maxH;
                        return { width: Math.round(w), height: Math.round(h) };
                      })()}
                    >
                      <div className="flex flex-col h-full items-center justify-center text-center gap-1 p-2 overflow-y-auto min-h-0">
                        <div style={{ fontSize: 8 }} className="font-bold shrink-0">{LABEL_OWNER}</div>
                        <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white border border-slate-200 p-0.5">
                          {previewQrUrl ? <img src={previewQrUrl} alt="QR Code" className="w-full h-full object-contain" /> : <div className="w-full h-full bg-slate-100 animate-pulse rounded" />}
                        </div>
                        <div style={{ fontSize: 6 }} className="font-semibold text-slate-800 shrink-0 min-h-[1rem] line-clamp-2 break-words w-full px-1">{activeAsset?.name || '-'}</div>
                        <div style={{ fontSize: 9 }} className="font-mono font-bold truncate max-w-full shrink-0">{activeAsset?.productId || '-'}</div>
                        {previewBarcodeUrl && (
                          <div className="h-6 flex items-center justify-center shrink-0">
                            <img src={previewBarcodeUrl} alt="Barcode" className="max-w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Units</label>
                    <select
                      value={printSettings.units}
                      onChange={(e) => {
                        const newUnit = e.target.value as 'inch' | 'mm' | 'cm';
                        const u = printSettings.units;
                        const toInch = (v: number, from: string) => from === 'inch' ? v : from === 'mm' ? v / 25.4 : v / 2.54;
                        const fromInch = (v: number, to: string) => to === 'inch' ? v : to === 'mm' ? v * 25.4 : v * 2.54;
                        const wIn = toInch(printSettings.width, u);
                        const hIn = toInch(printSettings.height, u);
                        setPrintSettings(p => ({
                          ...p,
                          units: newUnit,
                          width: Math.round(fromInch(wIn, newUnit) * 100) / 100,
                          height: Math.round(fromInch(hIn, newUnit) * 100) / 100,
                        }));
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500"
                    >
                      <option value="inch">inch</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        max="50"
                        value={printSettings.width}
                        onChange={(e) => setPrintSettings(p => ({ ...p, width: parseFloat(e.target.value) || 2.7 }))}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500"
                      />
                      <span className="text-sm text-slate-500 shrink-0">{printSettings.units}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        max="50"
                        value={printSettings.height}
                        onChange={(e) => setPrintSettings(p => ({ ...p, height: parseFloat(e.target.value) || 1.1 }))}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500"
                      />
                      <span className="text-sm text-slate-500 shrink-0">{printSettings.units}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
                    <select
                      value={printSettings.orientation}
                      onChange={(e) => setPrintSettings(p => ({ ...p, orientation: e.target.value as 'normal' | 'landscape' }))}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
                {!jspmConnected && (
                  <p className="text-xs text-slate-500 mt-4">Tip: In the print dialog, set paper size to match your label ({printSettings.width}×{printSettings.height} {printSettings.units}) for correct output.</p>
                )}
                <div className="flex flex-wrap justify-end gap-3 mt-6">
                  <button onClick={() => setIsPrintSettingsOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  {jspmConnected && printers.length > 0 ? (
                    <button
                      onClick={handlePrintDirect}
                      disabled={isPrintingDirect}
                      className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isPrintingDirect ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                      Print to {selectedPrinter || 'Printer'}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setIsPrintSettingsOpen(false); handlePrintTag(printSettings); }}
                      className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2"
                    >
                      <Printer size={16} /> Print (system dialog)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {
            isTransferOpen && (
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
                      <select value={transferLocation} onChange={e => { setTransferLocation(e.target.value); setTransferSubLocation('') }} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                        <option value="">Select Branch</option>
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Department</label>
                      <select value={transferSubLocation} onChange={e => setTransferSubLocation(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                        <option value="">Select Dept...</option>
                        {transferLocation && LOCATION_BRANCHES[transferLocation]?.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Custodian</label>
                      <select value={transferCustodianId} onChange={e => {
                        const id = e.target.value;
                        const u = custodianOptions.find(x => x.id === id);
                        setTransferCustodianId(id);
                        setTransferCustodian(u?.name || '');
                      }} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                        <option value="">Select Custodian...</option>
                        {custodianOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setIsTransferOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={submitTransfer} disabled={isTransferring || !transferLocation || !transferCustodianId || (!canInitiate && !canApprove)} className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center disabled:opacity-50" title={!canInitiate && !canApprove ? 'Insufficient permissions' : ''}>
                      {isTransferring && <Loader2 size={14} className="animate-spin mr-2" />}
                      Confirm Transfer
                    </button>
                  </div>
                </div>
              </div>
            )
          }
          {isCameraOpen && (
            <div className="fixed inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50 animate-fadeIn">
              <div className="absolute top-4 right-4">
                <button onClick={stopCamera} className="text-white hover:text-slate-200">
                  <X size={32} />
                </button>
              </div>
              {videoDevices.length > 0 && (
                <div className="absolute top-4 left-4 right-16 z-10 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-white text-xs font-medium mb-1">Scanning device</label>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => switchScanDevice(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 bg-slate-800/90 text-white rounded-lg border border-slate-600 text-sm focus:ring-2 focus:ring-qet-500 outline-none"
                    >
                      {videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Video device ${videoDevices.indexOf(d) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={async () => {
                      if (navigator.mediaDevices?.enumerateDevices) {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
                        setVideoDevices(videoInputs);
                        if (videoInputs.length > 0 && !videoInputs.some((d) => d.deviceId === selectedDeviceId)) {
                          setSelectedDeviceId(videoInputs[0].deviceId);
                          await startCamera(videoInputs[0].deviceId);
                        }
                      }
                    }}
                    className="px-3 py-2 bg-slate-700/90 text-white rounded-lg text-xs hover:bg-slate-600 border border-slate-600"
                  >
                    Refresh
                  </button>
                </div>
              )}
              <div className="relative w-full max-w-lg aspect-square bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-qet-500/50">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                <div className="absolute inset-0 border-2 border-qet-500/50 m-12 rounded-lg animate-pulse"></div>
                <div className="absolute bottom-6 left-0 right-0 gap-4 flex justify-center">
                  <button onClick={() => captureAndAnalyze()} className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full border-4 border-qet-600"></div>
                  </button>
                  {/* Development-only scan shortcut for testing without a physical barcode/QR. */}
                  {process.env.NODE_ENV === 'development' && assets.length > 0 && (
                    <button
                      onClick={() => {
                        stopCamera();
                        const demoAsset = assets[0];
                        selectAsset(demoAsset);
                        setNotificationMessage(`Simulated scan: ${demoAsset.productId}`);
                        setNotificationType('success');
                        setShowNotification(true);
                      }}
                      className="absolute right-6 bottom-4 px-4 py-2 bg-slate-800/80 text-white text-xs rounded-lg backdrop-blur-sm"
                    >
                      Simulate
                    </button>
                  )}
                </div>
              </div>
              <p className="text-white mt-4 font-medium">Align QR Code / Barcode within frame</p>
            </div>
          )}

          {
            isConditionOpen && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Update Asset Condition</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">New Condition Code</label>
                      <select value={newConditionCode} onChange={e => setNewConditionCode(e.target.value as ConditionCode)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
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
                    <button onClick={submitConditionUpdate} disabled={isUpdatingCondition} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">{isUpdatingCondition && <Loader2 size={14} className="animate-spin mr-2" />} Update Condition</button>
                  </div>
                </div>
              </div>
            )
          }

          {
            isReportOpen && (
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
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Issue Type</label><select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500"><option value="Damage">Physical Damage</option><option value="Malfunction">Functional Malfunction</option><option value="Lost">Lost / Stolen</option><option value="Maintenance">Routine Maintenance Needed</option><option value="Registration Error">Mistake/Error in Registration</option></select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg h-24 resize-none outline-none focus:ring-2 focus:ring-qet-500" placeholder="Describe the issue in detail..." /></div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsReportOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button><button onClick={submitReport} disabled={isSubmittingReport || !reportDesc} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50">{isSubmittingReport && <Loader2 size={16} className="animate-spin mr-2" />}Submit Report</button></div>
                </div>
              </div>
            )
          }

          {
            isAdjustmentOpen && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-purple-600" /> Update Asset Value
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAdjustmentType('Addition')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${adjustmentType === 'Addition' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          + Addition
                        </button>
                        <button
                          onClick={() => setAdjustmentType('Reduction')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${adjustmentType === 'Reduction' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          - Reduction
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₦)</label>
                      <input
                        type="number"
                        value={adjustmentAmount}
                        onChange={e => setAdjustmentAmount(e.target.value ? Number(e.target.value) : '')}
                        placeholder="0.00"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={adjustmentDate}
                        onChange={e => setAdjustmentDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description / Ref</label>
                      <textarea
                        value={adjustmentDesc}
                        onChange={e => setAdjustmentDesc(e.target.value)}
                        placeholder="Reason for adjustment, Ref #..."
                        className="w-full p-2 border border-slate-300 rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setIsAdjustmentOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button
                      onClick={submitValueAdjustment}
                      disabled={isSubmittingAdjustment || !adjustmentAmount}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center shadow-md disabled:opacity-50"
                    >
                      {isSubmittingAdjustment && <Loader2 size={16} className="animate-spin mr-2" />} Save Update
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          {auditNoteRequest && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {auditNoteRequest.status === 'Damaged' ? 'Describe Damage' : 'Missing Asset Notes'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  {auditNoteRequest.asset.productId} - {auditNoteRequest.asset.name}
                </p>
                <textarea
                  value={auditNoteText}
                  onChange={e => setAuditNoteText(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg h-28 resize-none outline-none focus:ring-2 focus:ring-qet-500"
                  placeholder={auditNoteRequest.required ? 'Notes are required for damaged assets' : 'Optional notes'}
                />
                <div className="flex justify-end gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setAuditNoteRequest(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={auditNoteRequest.required && !auditNoteText.trim()}
                    onClick={() => {
                      void handleVerifyAsset(auditNoteRequest.asset, auditNoteRequest.status, auditNoteText.trim() || undefined);
                      setAuditNoteRequest(null);
                    }}
                    className="px-5 py-2 bg-qet-600 text-white font-bold rounded-lg hover:bg-qet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Verification
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Modal */}
          {
            showNotification && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className={`p-6 text-white text-center ${notificationType === 'success' ? 'bg-gradient-to-r from-green-600 to-green-500' :
                    notificationType === 'error' ? 'bg-gradient-to-r from-red-600 to-red-500' :
                      'bg-gradient-to-r from-blue-600 to-blue-500'
                    }`}>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                      {notificationType === 'success' ? (
                        <CheckCircle2 size={40} className="text-green-600" />
                      ) : notificationType === 'error' ? (
                        <AlertTriangle size={40} className="text-red-600" />
                      ) : (
                        <Activity size={40} className="text-blue-600" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold">
                      {notificationType === 'success' ? 'Success!' :
                        notificationType === 'error' ? 'Error' :
                          'Information'}
                    </h3>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-slate-700 whitespace-pre-line">{notificationMessage}</p>
                    <button
                      onClick={() => setShowNotification(false)}
                      className={`mt-6 px-6 py-3 text-white font-bold rounded-lg shadow-lg w-full ${notificationType === 'success' ? 'bg-green-600 hover:bg-green-700' :
                        notificationType === 'error' ? 'bg-red-600 hover:bg-red-700' :
                          'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Image lightbox: click asset image to open full-screen */}
          {imageLightboxUrl && (
            <div
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-fadeIn"
              onClick={() => setImageLightboxUrl(null)}
              role="dialog"
              aria-label="Asset image (click to close)"
            >
              <button
                type="button"
                onClick={() => setImageLightboxUrl(null)}
                className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-10"
                aria-label="Close"
              >
                <X size={28} />
              </button>
              <img
                src={imageLightboxUrl}
                alt="Asset"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Hidden file input for image upload */}
          <input
            ref={assetImageUploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
          />
        </>
      )}
      {isPrintSelectedOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-screen">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Printer size={20} className="text-slate-600" /> Print Selected Tags
              </h3>
              <button onClick={() => setIsPrintSelectedOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {/* Printer selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Printer</label>
                {jspmConnected && printers.length > 0 ? (
                  <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                    {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Install JSPM Client to select printers. <a href="https://neodynamic.com/downloads/jspm" target="_blank" rel="noopener noreferrer" className="text-qet-600 hover:underline">Download</a></p>
                    <button type="button" onClick={loadPrinters} disabled={isLoadingPrinters} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 disabled:opacity-50 flex items-center gap-2">
                      {isLoadingPrinters ? <Loader2 size={12} className="animate-spin" /> : null} Load printers
                    </button>
                  </div>
                )}
              </div>
              {/* Label preview */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Label preview (first selected)</label>
                <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm mx-auto"
                  style={(() => {
                    const aspect = printSettings.orientation === 'landscape' ? printSettings.height / printSettings.width : printSettings.width / printSettings.height;
                    const maxW = 220, maxH = 140;
                    const w = aspect >= maxW / maxH ? maxW : maxH * aspect;
                    const h = aspect >= maxW / maxH ? maxW / aspect : maxH;
                    return { width: Math.round(w), height: Math.round(h) };
                  })()}>
                  <div className="flex flex-col h-full items-center justify-center text-center gap-1 p-2 overflow-hidden">
                    <div style={{ fontSize: 8 }} className="font-bold shrink-0">{LABEL_OWNER}</div>
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white border border-slate-200 p-0.5">
                      {previewSelectedQrUrl ? <img src={previewSelectedQrUrl} alt="QR" className="w-full h-full object-contain" /> : <div className="w-full h-full bg-slate-100 animate-pulse rounded" />}
                    </div>
                    <div style={{ fontSize: 6 }} className="font-semibold text-slate-800 shrink-0 break-words w-full px-1">{assets.find(a => selectedAssetIds.has(a.productId))?.name || '-'}</div>
                    <div style={{ fontSize: 9 }} className="font-mono font-bold truncate max-w-full shrink-0">{[...selectedAssetIds][0] || '-'}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 text-center"><strong>{selectedAssetIds.size}</strong> tag{selectedAssetIds.size > 1 ? 's' : ''} will be printed</p>
              </div>
              {/* Units */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Units</label>
                <select value={printSettings.units} onChange={(e) => { const newUnit = e.target.value as 'inch'|'mm'|'cm'; const u = printSettings.units; const wI = toInch(printSettings.width,u); const hI = toInch(printSettings.height,u); setPrintSettings(p => ({ ...p, units: newUnit, width: Math.round(toInch(wI,'inch') * (newUnit==='inch'?1:newUnit==='mm'?25.4:2.54)*100)/100, height: Math.round(toInch(hI,'inch') * (newUnit==='inch'?1:newUnit==='mm'?25.4:2.54)*100)/100 })); }} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                  <option value="inch">inch</option><option value="mm">mm</option><option value="cm">cm</option>
                </select>
              </div>
              {/* Width */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" min="0.5" max="50" value={printSettings.width} onChange={(e) => setPrintSettings(p => ({ ...p, width: parseFloat(e.target.value) || 2.7 }))} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500" />
                  <span className="text-sm text-slate-500 shrink-0">{printSettings.units}</span>
                </div>
              </div>
              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" min="0.5" max="50" value={printSettings.height} onChange={(e) => setPrintSettings(p => ({ ...p, height: parseFloat(e.target.value) || 1.1 }))} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-qet-500" />
                  <span className="text-sm text-slate-500 shrink-0">{printSettings.units}</span>
                </div>
              </div>
              {/* Orientation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
                <select value={printSettings.orientation} onChange={(e) => setPrintSettings(p => ({ ...p, orientation: e.target.value as 'normal'|'landscape' }))} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-qet-500">
                  <option value="normal">Normal</option><option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Tip: Set paper size to {printSettings.width}×{printSettings.height} {printSettings.units} in your print dialog.</p>
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button onClick={() => setIsPrintSelectedOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              {jspmConnected && printers.length > 0 ? (
                <button onClick={handlePrintSelectedDirect} disabled={isPrintingSelected} className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2 disabled:opacity-50">
                  {isPrintingSelected ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  {isPrintingSelected ? (printBatchProgress || 'Preparing...') : `Print to ${selectedPrinter || 'Printer'}`}
                </button>
              ) : (
                <button onClick={() => { setIsPrintSelectedOpen(false); handlePrintSelectedTags(printSettings); }} disabled={isPrintingSelected} className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 flex items-center gap-2 disabled:opacity-50">
                  <Printer size={16} />
                  {isPrintingSelected ? 'Preparing...' : `Print ${selectedAssetIds.size} Tag${selectedAssetIds.size > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetLookup;
