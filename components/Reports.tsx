
import React, { useState } from 'react';
import { Download, Filter, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { MOCK_ASSETS, CATEGORIES, LOCATIONS } from '../constants';

const Reports: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter the assets based on selected status
  const filteredAssets = MOCK_ASSETS.filter(asset => {
    if (statusFilter === 'All') return true;
    return asset.status === statusFilter;
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

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-20 md:pb-0">
      
      {/* Filters Column */}
      <div className="w-full md:w-80 flex-shrink-0 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <Filter size={20} className="mr-2 text-ptdf-600" /> Report Filters
        </h2>
        
        <div className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
               <input type="date" className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs" />
               <input type="date" className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Status</label>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="status" 
                  className="text-ptdf-600 focus:ring-ptdf-500" 
                  checked={statusFilter === 'All'}
                  onChange={() => setStatusFilter('All')}
                />
                <span className="text-sm text-slate-700">All Statuses</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="status" 
                  className="text-ptdf-600 focus:ring-ptdf-500" 
                  checked={statusFilter === 'Active'}
                  onChange={() => setStatusFilter('Active')}
                />
                <span className="text-sm text-slate-700">Active Only</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="status" 
                  className="text-ptdf-600 focus:ring-ptdf-500" 
                  checked={statusFilter === 'Maintenance'}
                  onChange={() => setStatusFilter('Maintenance')}
                />
                <span className="text-sm text-slate-700">Maintenance</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="status" 
                  className="text-ptdf-600 focus:ring-ptdf-500" 
                  checked={statusFilter === 'Disposed'}
                  onChange={() => setStatusFilter('Disposed')}
                />
                <span className="text-sm text-slate-700">Disposed</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Locations</label>
            <select className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-ptdf-500 outline-none">
              <option>All Locations</option>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categories</label>
            <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 p-2 rounded bg-white">
              {CATEGORIES.map(cat => (
                <div key={cat} className="flex items-center">
                  <input type="checkbox" id={cat} className="mr-2 text-ptdf-600 focus:ring-ptdf-500 rounded" defaultChecked />
                  <label htmlFor={cat} className="text-sm text-slate-700">{cat}</label>
                </div>
              ))}
            </div>
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

      {/* Report Preview Column */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Asset Register Preview</h2>
            <p className="text-sm text-slate-500">
              Showing {filteredAssets.length} records • Filter: <span className="font-semibold text-ptdf-600">{statusFilter}</span>
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

        <div className="flex-1 overflow-auto border rounded-lg relative">
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
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-mono text-slate-600">{asset.productId}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                    <td className="p-4 text-sm font-semibold text-slate-800 text-right">₦{asset.netBookValue.toLocaleString()}</td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium
                        ${asset.status === 'Active' ? 'bg-green-100 text-green-700' : 
                          asset.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' : 
                          asset.status === 'Disposed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}
                      `}>
                        {asset.status}
                      </span>
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
      </div>
    </div>
  );
};

export default Reports;
