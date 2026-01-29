
import React, { useState } from 'react';
import { Download, Filter, FileText, CheckCircle, Loader2, Calendar, ArrowLeft, ArrowRightLeft, Trash2 } from 'lucide-react';
import { CATEGORIES, LOCATIONS, CONDITION_DESCRIPTIONS, MOCK_ASSET_HISTORY } from '../constants';
import { ConditionCode, Asset } from '../types';

interface ReportsProps {
  onBack?: () => void;
  onNavigateToAsset?: (assetId: string) => void;
  assets?: Asset[];
}

const Reports: React.FC<ReportsProps> = ({ onBack, onNavigateToAsset, assets = [] }) => {
  const [reportType, setReportType] = useState<string>('Asset Register Summary');
  const [filterStatusGroup, setFilterStatusGroup] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [selectedConditions, setSelectedConditions] = useState<ConditionCode[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter groups
  const OPERATIONAL_CODES: ConditionCode[] = ['A1', 'A2', 'A3', 'A4'];
  const MAINTENANCE_CODES: ConditionCode[] = ['F1', 'F2', 'F3'];
  const DISPOSED_CODES: ConditionCode[] = ['F4'];

  const toggleCondition = (code: ConditionCode) => {
    if (selectedConditions.includes(code)) {
      setSelectedConditions(selectedConditions.filter(c => c !== code));
    } else {
      setSelectedConditions([...selectedConditions, code]);
    }
  };

  const selectGroup = (group: 'All' | 'Operational' | 'Maintenance' | 'Disposed') => {
    setFilterStatusGroup(group);
    if (group === 'All') setSelectedConditions([]);
    else if (group === 'Operational') setSelectedConditions(OPERATIONAL_CODES);
    else if (group === 'Maintenance') setSelectedConditions(MAINTENANCE_CODES);
    else if (group === 'Disposed') setSelectedConditions(DISPOSED_CODES);
  };

  // Filter the assets
  const filteredAssets = assets.filter(asset => {
    // Condition Filtering
    let matchesCondition = true;
    if (filterStatusGroup !== 'All' || selectedConditions.length > 0) {
      if (selectedConditions.length > 0) {
        matchesCondition = !!asset.conditionCode && selectedConditions.includes(asset.conditionCode);
      }
    }

    // Category Filtering
    let matchesCategory = true;
    if (filterCategory !== 'All') {
      matchesCategory = asset.category === filterCategory;
    }

    // Location Filtering
    let matchesLocation = true;
    if (filterLocation !== 'All') {
      matchesLocation = asset.location === filterLocation;
    }

    // Date Range Filtering
    let matchesDate = true;
    if (dateRange.from) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) >= new Date(dateRange.from);
    }
    if (dateRange.to) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) <= new Date(dateRange.to);
    }

    // For Disposal List, specifically filter for disposed assets
    if (reportType === 'Disposal List') {
      return asset.status === 'Disposed' || asset.conditionCode === 'F4';
    }

    return matchesCondition && matchesDate && matchesCategory && matchesLocation;
  });

  // Data Aggregation for Fixed Asset Schedule
  const generateScheduleData = () => {
    const map = new Map<string, { category: string, cost: number, accumulatedDepr: number, nbv: number, additions: number }>();
    const currentYear = new Date().getFullYear();

    filteredAssets.forEach(asset => {
      const accumulatedDepreciation = asset.acquisitionCost - asset.netBookValue;
      // Calculate additions for the current year or selected period
      const assetAdditions = asset.improvements
        ? asset.improvements
          .filter(imp => imp.type === 'Addition' && new Date(imp.date).getFullYear() === currentYear)
          .reduce((sum, imp) => sum + imp.amount, 0)
        : 0;

      if (!map.has(asset.category)) {
        map.set(asset.category, { category: asset.category, cost: 0, accumulatedDepr: 0, nbv: 0, additions: 0 });
      }
      const entry = map.get(asset.category)!;
      entry.cost += asset.acquisitionCost;
      entry.accumulatedDepr += accumulatedDepreciation;
      entry.nbv += asset.netBookValue;
      entry.additions += assetAdditions;
    });

    return Array.from(map.values());
  };

  // Filter Transfers for Transfer Report
  const transferHistory = MOCK_ASSET_HISTORY.filter(h =>
    h.type === 'Transfer' &&
    (filterCategory === 'All' || assets.find(a => a.id === h.assetId)?.category === filterCategory)
  );

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
    }, 2000);
  };

  const getBadgeColor = (code?: ConditionCode) => {
    if (!code) return 'bg-slate-100 text-slate-700';
    if (OPERATIONAL_CODES.includes(code)) return 'bg-green-100 text-green-800 border-green-200';
    if (MAINTENANCE_CODES.includes(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (DISPOSED_CODES.includes(code)) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700';
  };

  const getDepreciationForYear = (asset: Asset) => {
    if (!asset.usefulLife || asset.usefulLife <= 0) return 0;
    const salvage = asset.salvageValue || 0;
    return (asset.acquisitionCost - salvage) / asset.usefulLife;
  };

  const renderReportTable = () => {
    switch (reportType) {
      case 'Asset Register Summary':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Additions</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Depreciation (Year)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accumulated Depr.</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const accumulatedDepreciation = asset.acquisitionCost - asset.netBookValue;
                  const yearlyDepr = getDepreciationForYear(asset);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigateToAsset && onNavigateToAsset(asset.id)}>
                      <td className="p-4 text-sm font-mono text-slate-600 group-hover:text-abdc-600 font-bold">{asset.productId}</td>
                      <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">
                        {asset.improvements ? `₦${asset.improvements.reduce((acc, imp) => imp.type === 'Addition' ? acc + imp.amount : acc, 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{yearlyDepr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{accumulatedDepreciation.toLocaleString()}</td>
                      <td className="p-4 text-sm font-semibold text-slate-800 text-right">₦{asset.netBookValue.toLocaleString()}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getBadgeColor(asset.conditionCode)}`}>
                          {asset.conditionCode || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No assets found matching the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Fixed Asset Schedule':
        const scheduleData = generateScheduleData();
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Additions (Year)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Accumulated Depr.</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Net Book Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scheduleData.length > 0 ? (
                <>
                  {scheduleData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 text-sm font-bold text-slate-800">{row.category}</td>
                      <td className="p-4 text-sm text-right">₦{row.cost.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right text-green-600">
                        {row.additions > 0 ? `+₦${row.additions.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 text-sm text-right">₦{row.accumulatedDepr.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-abdc-700 text-right">₦{row.nbv.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
                    <td className="p-4 text-sm uppercase text-slate-700">Total</td>
                    <td className="p-4 text-sm text-right text-slate-900">₦{scheduleData.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</td>
                    <td className="p-4 text-sm text-right text-green-700">₦{scheduleData.reduce((sum, r) => sum + r.additions, 0).toLocaleString()}</td>
                    <td className="p-4 text-sm text-right text-slate-900">₦{scheduleData.reduce((sum, r) => sum + r.accumulatedDepr, 0).toLocaleString()}</td>
                    <td className="p-4 text-sm text-right text-abdc-800 text-lg">₦{scheduleData.reduce((sum, r) => sum + r.nbv, 0).toLocaleString()}</td>
                  </tr>
                </>
              ) : (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">No data available.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Depreciation Schedule':
        // Calculate Totals
        const totalCost = filteredAssets.reduce((sum, a) => sum + a.acquisitionCost, 0);
        const totalCurrentDepr = filteredAssets.reduce((sum, a) => sum + getDepreciationForYear(a), 0);
        const totalAccumDepr = filteredAssets.reduce((sum, a) => sum + (a.acquisitionCost - a.netBookValue), 0);

        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Useful Life (Yrs)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Current Depreciation</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accumulated Depr.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                <>
                  {filteredAssets.map((asset) => {
                    const accumulatedDepreciation = asset.acquisitionCost - asset.netBookValue;
                    const yearlyDepr = getDepreciationForYear(asset);
                    return (
                      <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm font-mono text-slate-600">{asset.productId}</td>
                        <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                        <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                        <td className="p-4 text-sm text-slate-600 text-right">{asset.usefulLife || '-'}</td>
                        <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                        <td className="p-4 text-sm text-slate-600 text-right">₦{yearlyDepr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="p-4 text-sm font-bold text-slate-700 text-right">₦{accumulatedDepreciation.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr className="bg-abdc-50 font-bold border-t-2 border-abdc-200">
                    <td colSpan={3} className="p-4 text-sm text-abdc-800 text-right uppercase tracking-wider">Total</td>
                    <td className="p-4 text-sm text-right">-</td>
                    <td className="p-4 text-sm text-right text-abdc-800">₦{totalCost.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right text-abdc-800">₦{totalCurrentDepr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="p-4 text-sm text-right text-abdc-800">₦{totalAccumDepr.toLocaleString()}</td>
                  </tr>
                </>
              ) : (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No assets found matching the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Transfer Report':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">From Location</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">To Location</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Custodian</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Action By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferHistory.length > 0 ? (
                transferHistory.map(h => {
                  const asset = assets.find(a => a.id === h.assetId);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm text-slate-600">{h.date}</td>
                      <td className="p-4 text-sm font-mono font-medium text-slate-800">{asset ? asset.productId : 'Unknown'}</td>
                      <td className="p-4 text-sm text-slate-600">{h.fromLocation || '-'}</td>
                      <td className="p-4 text-sm text-abdc-700 font-medium flex items-center gap-1"><ArrowRightLeft size={12} /> {h.toLocation || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{h.toCustodian || '-'}</td>
                      <td className="p-4 text-sm text-slate-500">{h.user}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transfer records found.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Disposal List':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Disposal Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Mode of Disposal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigateToAsset && onNavigateToAsset(asset.id)}>
                    <td className="p-4 text-sm font-mono text-slate-600 group-hover:text-abdc-600 font-bold">{asset.productId}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.netBookValue.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.disposalDate || 'N/A'}</td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${asset.disposalMode === 'Sold' ? 'bg-green-100 text-green-700 border-green-200' :
                        asset.disposalMode === 'Donated' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-red-100 text-red-700 border-red-200'
                        }`}>
                        {asset.disposalMode === 'Scrapped' ? <Trash2 size={12} className="mr-1" /> : null}
                        {asset.disposalMode || 'Disposed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No disposed assets found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      default:
        // Generic Fallback
        return (
          <div className="p-8 text-center text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>Select a specific report type to view data.</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-20 md:pb-0">

      {/* Filters Column */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-sm text-slate-500 hover:text-abdc-600 transition-colors group self-start"
          >
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit overflow-y-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Filter size={20} className="mr-2 text-abdc-600" /> Report Filters
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-abdc-500 outline-none"
              >
                <option value="Asset Register Summary">Asset Register Summary</option>
                <option value="Fixed Asset Schedule">Fixed Asset Schedule</option>
                <option value="Depreciation Schedule">Depreciation Schedule</option>
                <option value="Transfer Report">Transfer Report</option>
                <option value="Disposal List">Disposal List</option>
              </select>
            </div>

            {/* Asset Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Asset Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-abdc-500 outline-none"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Asset Location Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-abdc-500 outline-none"
              >
                <option value="All">All Locations</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Acquisition Date Range</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-abdc-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-abdc-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Condition & Status</label>

              {/* Quick Groups */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => selectGroup('All')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'All' ? 'bg-abdc-50 border-abdc-500 text-abdc-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>All</button>
                <button onClick={() => selectGroup('Operational')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Operational' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Active</button>
                <button onClick={() => selectGroup('Maintenance')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Maintenance' ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Issue</button>
                <button onClick={() => selectGroup('Disposed')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Disposed' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Disp</button>
              </div>

              {/* Detailed Checkboxes */}
              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-100 rounded p-2 bg-slate-50">
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Operational (Active)</p>
                {OPERATIONAL_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-abdc-600 focus:ring-abdc-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}

                <p className="text-[10px] uppercase text-slate-400 font-bold mt-2 mb-1">Maintenance / Repair</p>
                {MAINTENANCE_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-amber-600 focus:ring-amber-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}

                <p className="text-[10px] uppercase text-slate-400 font-bold mt-2 mb-1">Disposal</p>
                {DISPOSED_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-red-600 focus:ring-red-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full py-2 bg-abdc-600 text-white rounded-lg font-medium hover:bg-abdc-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" /> Generating...
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview Column */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{reportType}</h2>
            <p className="text-sm text-slate-500">
              {filteredAssets.length} Records • Status: <span className="font-semibold text-abdc-600">{filterStatusGroup}</span>
              {filterCategory !== 'All' ? <span className="ml-2 font-medium text-slate-600">• {filterCategory}</span> : ''}
              {filterLocation !== 'All' ? <span className="ml-2 font-medium text-slate-600">• {filterLocation}</span> : ''}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting || isGenerating}
            className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg relative mb-4">
          {isGenerating ? (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-abdc-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Generating report data...</p>
            </div>
          ) : null}

          {renderReportTable()}

        </div>

        {/* Status Index / Legend */}
        {reportType === 'Asset Register Summary' && (
          <div className="mt-auto border-t border-slate-100 pt-4 bg-slate-50/50 -mx-6 -mb-6 px-6 pb-6">
            <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center">
              <FileText size={14} className="mr-1" /> Status Index Key
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              {Object.entries(CONDITION_DESCRIPTIONS).map(([code, desc]) => (
                <div key={code} className="flex items-center">
                  <span className={`inline-block w-8 text-center font-bold px-1 py-0.5 rounded border mr-2 flex-shrink-0 ${getBadgeColor(code as ConditionCode)}`}>
                    {code}
                  </span>
                  <span className="text-slate-600 truncate" title={desc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
