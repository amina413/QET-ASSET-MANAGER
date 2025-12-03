
import React, { useState } from 'react';
import { Download, Filter, FileText, CheckCircle, Loader2, Calendar, ArrowLeft } from 'lucide-react';
import { MOCK_ASSETS, CATEGORIES, LOCATIONS, CONDITION_DESCRIPTIONS } from '../constants';
import { ConditionCode } from '../types';

interface ReportsProps {
  onBack?: () => void;
}

const Reports: React.FC<ReportsProps> = ({ onBack }) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
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
    setFilterCategory(group);
    if (group === 'All') setSelectedConditions([]);
    else if (group === 'Operational') setSelectedConditions(OPERATIONAL_CODES);
    else if (group === 'Maintenance') setSelectedConditions(MAINTENANCE_CODES);
    else if (group === 'Disposed') setSelectedConditions(DISPOSED_CODES);
  };

  // Filter the assets based on selected conditions and date range
  const filteredAssets = MOCK_ASSETS.filter(asset => {
    // Condition Filtering
    let matchesCondition = true;
    if (filterCategory !== 'All' || selectedConditions.length > 0) {
      if (selectedConditions.length > 0) {
         // Use optional chaining or type assertion if conditionCode implies it exists for the check
         matchesCondition = !!asset.conditionCode && selectedConditions.includes(asset.conditionCode);
      }
    }

    // Date Range Filtering
    let matchesDate = true;
    if (dateRange.from) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) >= new Date(dateRange.from);
    }
    if (dateRange.to) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) <= new Date(dateRange.to);
    }
    
    return matchesCondition && matchesDate;
  });

  const handleGenerateReport = () => {
    setIsGenerating(true);
    // Simulate backend report generation delay
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleExport = () => {
    setIsExporting(true);
    // Simulate file generation and download delay
    setTimeout(() => {
      setIsExporting(false);
      // Logic for actual export would trigger here
    }, 2000);
  };

  const getBadgeColor = (code?: ConditionCode) => {
    if (!code) return 'bg-slate-100 text-slate-700';
    if (OPERATIONAL_CODES.includes(code)) return 'bg-green-100 text-green-800 border-green-200';
    if (MAINTENANCE_CODES.includes(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (DISPOSED_CODES.includes(code)) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-20 md:pb-0">
      
      {/* Filters Column */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center text-sm text-slate-500 hover:text-ptdf-600 transition-colors group self-start"
          >
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit overflow-y-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Filter size={20} className="mr-2 text-ptdf-600" /> Report Filters
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Report Type</label>
              <select className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-ptdf-500 outline-none">
                <option>Asset Register Summary</option>
                <option>Valuation Report</option>
                <option>Depreciation Schedule</option>
                <option>Disposal List</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Acquisition Date Range</label>
              <div className="flex gap-2">
                <div className="flex-1">
                   <label className="block text-[10px] text-slate-400 mb-1">From</label>
                   <div className="relative">
                      <input 
                        type="date" 
                        value={dateRange.from}
                        onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                        className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-ptdf-500 outline-none" 
                      />
                   </div>
                </div>
                <div className="flex-1">
                   <label className="block text-[10px] text-slate-400 mb-1">To</label>
                   <div className="relative">
                      <input 
                        type="date" 
                        value={dateRange.to}
                        onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                        className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-ptdf-500 outline-none" 
                      />
                   </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Condition & Status</label>
              
              {/* Quick Groups */}
              <div className="flex gap-2 mb-3">
                 <button onClick={() => selectGroup('All')} className={`flex-1 py-1 text-xs rounded border ${filterCategory === 'All' ? 'bg-ptdf-50 border-ptdf-500 text-ptdf-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>All</button>
                 <button onClick={() => selectGroup('Operational')} className={`flex-1 py-1 text-xs rounded border ${filterCategory === 'Operational' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Active</button>
                 <button onClick={() => selectGroup('Maintenance')} className={`flex-1 py-1 text-xs rounded border ${filterCategory === 'Maintenance' ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Issue</button>
                 <button onClick={() => selectGroup('Disposed')} className={`flex-1 py-1 text-xs rounded border ${filterCategory === 'Disposed' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Disp</button>
              </div>

              {/* Detailed Checkboxes */}
              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-100 rounded p-2 bg-slate-50">
                 <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Operational (Active)</p>
                 {OPERATIONAL_CODES.map(code => (
                   <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                     <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-ptdf-600 focus:ring-ptdf-500" />
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

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Locations</label>
              <select className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-ptdf-500 outline-none">
                <option>All Locations</option>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100">
               <button 
                 onClick={handleGenerateReport}
                 disabled={isGenerating}
                 className="w-full py-2 bg-ptdf-600 text-white rounded-lg font-medium hover:bg-ptdf-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
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
            <h2 className="text-xl font-bold text-slate-800">Asset Register Preview</h2>
            <p className="text-sm text-slate-500">
              Showing {filteredAssets.length} records • Category: <span className="font-semibold text-ptdf-600">{filterCategory}</span>
              {dateRange.from || dateRange.to ? <span className="ml-2 font-medium text-slate-600">• Date Filter Active</span> : ''}
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
              <Loader2 size={48} className="text-ptdf-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Generating report data...</p>
            </div>
          ) : null}

          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Acquisition Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Condition / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-mono text-slate-600">{asset.productId}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.acquisitionDate}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                    <td className="p-4 text-sm font-semibold text-slate-800 text-right">₦{asset.netBookValue.toLocaleString()}</td>
                    <td className="p-4 text-sm">
                      <div className={`inline-flex items-center px-2 py-1 rounded border ${getBadgeColor(asset.conditionCode)}`}>
                        <span className="font-bold text-xs mr-2">{asset.conditionCode || 'N/A'}</span>
                        <span className="text-[10px] font-medium uppercase truncate max-w-[100px]">{CONDITION_DESCRIPTIONS[asset.conditionCode as ConditionCode] || asset.status}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No assets found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status Index / Legend */}
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
      </div>
    </div>
  );
};

export default Reports;
