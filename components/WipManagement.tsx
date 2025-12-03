
import React, { useState } from 'react';
import { Construction, Plus, Search, ChevronRight, Calculator, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, DollarSign, Calendar, User, Save, Trash2, X, ArrowLeft } from 'lucide-react';
import { MOCK_WIP_ASSETS, MOCK_ASSETS, MOCK_USERS, CATEGORIES } from '../constants';
import { WipAsset, CostLineItem, Asset } from '../types';

interface WipManagementProps {
  onBack?: () => void;
}

const WipManagement: React.FC<WipManagementProps> = ({ onBack }) => {
  const [wipProjects, setWipProjects] = useState<WipAsset[]>(MOCK_WIP_ASSETS);
  const [selectedProject, setSelectedProject] = useState<WipAsset | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  // Cost Ledger State
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [newCostItem, setNewCostItem] = useState<Partial<CostLineItem>>({
    type: 'Materials',
    date: new Date().toISOString().split('T')[0]
  });

  // Capitalization State
  const [isCapitalizing, setIsCapitalizing] = useState(false);
  const [isProcessingCap, setIsProcessingCap] = useState(false);

  // New Project State
  const [newProject, setNewProject] = useState<Partial<WipAsset>>({
    status: 'Planning',
    costLedger: []
  });

  // Calculations
  const calculateTotalCost = (project: WipAsset) => {
    return project.costLedger.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateVariance = (project: WipAsset) => {
    const total = calculateTotalCost(project);
    return project.budgetedCost - total;
  };

  // --- Handlers ---

  const handleCreateProject = () => {
    const id = `AUC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const project: WipAsset = {
        id,
        projectName: newProject.projectName || 'New Project',
        assetType: newProject.assetType || 'Plant and Machinery',
        projectManager: newProject.projectManager || 'Unassigned',
        budgetedCost: Number(newProject.budgetedCost) || 0,
        inceptionDate: newProject.inceptionDate || new Date().toISOString().split('T')[0],
        estimatedCompletionDate: newProject.estimatedCompletionDate || '',
        status: newProject.status as any || 'Planning',
        finalDepreciationMethod: newProject.finalDepreciationMethod || 'Straight-Line',
        finalUsefulLife: Number(newProject.finalUsefulLife) || 5,
        costLedger: []
    };

    setWipProjects([...wipProjects, project]);
    setViewMode('list');
    setNewProject({ status: 'Planning', costLedger: [] });
  };

  const handleAddCost = () => {
    if (!selectedProject || !newCostItem.amount || !newCostItem.vendor) return;

    const lineItem: CostLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      date: newCostItem.date || new Date().toISOString().split('T')[0],
      type: newCostItem.type as any,
      vendor: newCostItem.vendor || '',
      amount: Number(newCostItem.amount),
      referenceDoc: newCostItem.referenceDoc || '',
      description: newCostItem.description || ''
    };

    const updatedProject = {
      ...selectedProject,
      costLedger: [...selectedProject.costLedger, lineItem]
    };

    updateProjectState(updatedProject);
    setIsAddingCost(false);
    setNewCostItem({ type: 'Materials', date: new Date().toISOString().split('T')[0], amount: 0, vendor: '', referenceDoc: '', description: '' });
  };

  const updateProjectState = (updatedProject: WipAsset) => {
    setWipProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setSelectedProject(updatedProject);
  };

  const handleCapitalize = () => {
    if (!selectedProject) return;
    setIsProcessingCap(true);

    setTimeout(() => {
        // Create new Asset in Register
        const totalCost = calculateTotalCost(selectedProject);
        const newAsset: Asset = {
            id: (MOCK_ASSETS.length + 500).toString(),
            productId: `PTDF-${selectedProject.id.split('-')[1]}-${Math.floor(1000 + Math.random() * 9000)}`, // Generate Tag
            name: selectedProject.projectName,
            category: selectedProject.assetType,
            acquisitionCost: totalCost,
            acquisitionDate: new Date().toISOString().split('T')[0], // Date Placed in Service
            netBookValue: totalCost, // Initial NBV
            location: 'Unassigned',
            custodian: selectedProject.projectManager,
            status: 'Active',
            conditionCode: 'A1',
            image: 'https://picsum.photos/200/200'
        };

        // Add to main mock db (simulated)
        MOCK_ASSETS.push(newAsset);

        // Update WIP Status
        const finalizedProject = { ...selectedProject, status: 'Capitalized' as any };
        updateProjectState(finalizedProject);
        
        setIsProcessingCap(false);
        setIsCapitalizing(false);
        alert(`Asset Capitalized Successfully! New Asset ID: ${newAsset.productId}`);
    }, 2000);
  };

  const filteredProjects = wipProjects.filter(p => 
    p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Render Views ---

  if (viewMode === 'create') {
    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fadeIn">
            <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                <h1 className="text-2xl font-bold text-slate-800">Create New Project</h1>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                        <input type="text" className="w-full p-2 bg-white border border-slate-300 rounded-lg" placeholder="e.g. New Annex Building" 
                            onChange={e => setNewProject({...newProject, projectName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type (Final)</label>
                        <select className="w-full p-2 bg-white border border-slate-300 rounded-lg" onChange={e => setNewProject({...newProject, assetType: e.target.value})}>
                            <option value="">Select Category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {newProject.assetType === 'Software Licenses' && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center">
                                <AlertTriangle size={12} className="mr-1"/> Only Capitalize Development Phase costs.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Project Manager</label>
                        <select className="w-full p-2 bg-white border border-slate-300 rounded-lg" onChange={e => setNewProject({...newProject, projectManager: e.target.value})}>
                            <option value="">Select User</option>
                            {MOCK_USERS.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget (₦)</label>
                        <input type="number" className="w-full p-2 bg-white border border-slate-300 rounded-lg" placeholder="0.00" 
                            onChange={e => setNewProject({...newProject, budgetedCost: Number(e.target.value)})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Inception Date</label>
                        <input type="date" className="w-full p-2 bg-white border border-slate-300 rounded-lg" 
                            onChange={e => setNewProject({...newProject, inceptionDate: e.target.value})}/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Est. Completion Date</label>
                        <input type="date" className="w-full p-2 bg-white border border-slate-300 rounded-lg" 
                            onChange={e => setNewProject({...newProject, estimatedCompletionDate: e.target.value})}/>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                    <button onClick={() => setViewMode('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                    <button onClick={handleCreateProject} className="px-6 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700">Start Project</button>
                </div>
            </div>
        </div>
    );
  }

  if (viewMode === 'detail' && selectedProject) {
    const totalCost = calculateTotalCost(selectedProject);
    const variance = calculateVariance(selectedProject);
    const progressPercent = Math.min(100, Math.round((totalCost / selectedProject.budgetedCost) * 100));

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fadeIn">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setViewMode('list')} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700">
                        <ArrowRight size={20} className="rotate-180"/>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {selectedProject.projectName}
                            <span className={`text-xs px-2 py-1 rounded-full border ${selectedProject.status === 'Capitalized' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                {selectedProject.status}
                            </span>
                        </h1>
                        <p className="text-sm text-slate-500">ID: {selectedProject.id} • Managed by {selectedProject.projectManager}</p>
                    </div>
                </div>
                {selectedProject.status !== 'Capitalized' && (
                    <button 
                        onClick={() => setIsCapitalizing(true)}
                        className="px-4 py-2 bg-accent-500 text-white font-bold rounded-lg hover:bg-accent-600 shadow-sm flex items-center gap-2"
                    >
                        <CheckCircle2 size={18} /> Capitalize Asset
                    </button>
                )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Budget</p>
                    <p className="text-xl font-bold text-slate-800">₦{selectedProject.budgetedCost.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Accumulated Cost</p>
                    <p className="text-xl font-bold text-ptdf-700">₦{totalCost.toLocaleString()}</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
                        <div className="bg-ptdf-600 h-1.5 rounded-full" style={{width: `${progressPercent}%`}}></div>
                    </div>
                </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Remaining Budget</p>
                    <p className={`text-xl font-bold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₦{variance.toLocaleString()}
                    </p>
                </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Target Date</p>
                    <p className="text-xl font-bold text-slate-800">{selectedProject.estimatedCompletionDate || 'N/A'}</p>
                </div>
            </div>

            {/* Cost Ledger */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Calculator size={20} className="text-ptdf-600"/> Cost Accumulation Ledger
                        </h3>
                        {selectedProject.assetType === 'Software Licenses' && (
                             <p className="text-xs text-slate-500 mt-1">
                                Note: Research phase costs should be expensed. Only capitalize Development.
                             </p>
                        )}
                    </div>
                    {selectedProject.status !== 'Capitalized' && (
                        <button onClick={() => setIsAddingCost(!isAddingCost)} className="px-3 py-1.5 bg-white border border-ptdf-200 text-ptdf-700 rounded-lg text-sm font-medium hover:bg-ptdf-50">
                            {isAddingCost ? 'Cancel' : '+ Add Cost Item'}
                        </button>
                    )}
                </div>

                {/* Add Cost Form Inline */}
                {isAddingCost && (
                    <div className="p-4 bg-ptdf-50 border-b border-ptdf-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                        <div className="lg:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Date</label>
                            <input type="date" className="w-full p-2 text-sm bg-white border border-slate-300 rounded" value={newCostItem.date} onChange={e => setNewCostItem({...newCostItem, date: e.target.value})}/>
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Type</label>
                            <select className="w-full p-2 text-sm bg-white border border-slate-300 rounded" value={newCostItem.type} onChange={e => setNewCostItem({...newCostItem, type: e.target.value as any})}>
                                <option>Materials</option>
                                <option>External Labor</option>
                                <option>Internal Labor</option>
                                <option>Professional Fees</option>
                                <option>Interest Capitalization</option>
                                <option>Software Dev</option>
                            </select>
                        </div>
                         <div className="lg:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Vendor</label>
                            <input type="text" placeholder="Vendor Name" className="w-full p-2 text-sm bg-white border border-slate-300 rounded" value={newCostItem.vendor} onChange={e => setNewCostItem({...newCostItem, vendor: e.target.value})}/>
                        </div>
                         <div className="lg:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Doc Ref #</label>
                            <input type="text" placeholder="INV-001" className="w-full p-2 text-sm bg-white border border-slate-300 rounded" value={newCostItem.referenceDoc} onChange={e => setNewCostItem({...newCostItem, referenceDoc: e.target.value})}/>
                        </div>
                         <div className="lg:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Amount (₦)</label>
                            <input type="number" placeholder="0.00" className="w-full p-2 text-sm bg-white border border-slate-300 rounded" value={newCostItem.amount || ''} onChange={e => setNewCostItem({...newCostItem, amount: Number(e.target.value)})}/>
                        </div>
                        <div className="lg:col-span-1">
                            <button onClick={handleAddCost} className="w-full py-2 bg-ptdf-600 text-white rounded text-sm font-bold">Add Entry</button>
                        </div>
                    </div>
                )}

                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                            <th className="p-4 font-medium">Date</th>
                            <th className="p-4 font-medium">Description</th>
                            <th className="p-4 font-medium">Type</th>
                            <th className="p-4 font-medium">Vendor / Ref</th>
                            <th className="p-4 font-medium text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {selectedProject.costLedger.length > 0 ? (
                            selectedProject.costLedger.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-4 text-slate-600">{item.date}</td>
                                    <td className="p-4 text-slate-800 font-medium">{item.description}</td>
                                    <td className="p-4">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{item.type}</span>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        <div className="font-medium">{item.vendor}</div>
                                        <div className="text-xs text-slate-400">{item.referenceDoc}</div>
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-800">₦{item.amount.toLocaleString()}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No costs recorded yet.</td></tr>
                        )}
                         {selectedProject.costLedger.length > 0 && (
                            <tr className="bg-slate-50 font-bold">
                                <td colSpan={4} className="p-4 text-right text-slate-600 uppercase text-xs tracking-wider">Total Accumulated Cost</td>
                                <td className="p-4 text-right text-ptdf-700 text-base">₦{totalCost.toLocaleString()}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Capitalization Modal */}
            {isCapitalizing && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-blob">
                        <div className="bg-ptdf-600 p-6 text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle2 /> Finalize & Capitalize Asset
                            </h3>
                            <p className="text-ptdf-100 text-sm mt-1">This will lock the project and move the asset to the main register.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-500 text-sm">Final Asset Name:</span>
                                    <span className="font-bold text-slate-800">{selectedProject.projectName}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-500 text-sm">Total Capitalized Value:</span>
                                    <span className="font-bold text-ptdf-700 text-lg">₦{totalCost.toLocaleString()}</span>
                                </div>
                                 <div className="flex justify-between">
                                    <span className="text-slate-500 text-sm">Date Placed in Service:</span>
                                    <span className="font-bold text-slate-800">{new Date().toISOString().split('T')[0]}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Depreciation Method</label>
                                        <input type="text" disabled value={selectedProject.finalDepreciationMethod} className="w-full p-2 bg-slate-100 rounded text-sm"/>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Useful Life (Years)</label>
                                        <input type="text" disabled value={selectedProject.finalUsefulLife} className="w-full p-2 bg-slate-100 rounded text-sm"/>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                    <AlertTriangle size={14} className="inline mr-1 mb-0.5"/>
                                    Warning: Once capitalized, no further costs can be added to this project ID.
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                            <button onClick={() => setIsCapitalizing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button 
                                onClick={handleCapitalize} 
                                disabled={isProcessingCap}
                                className="px-6 py-2 bg-ptdf-600 text-white font-bold rounded-lg hover:bg-ptdf-700 flex items-center shadow-lg shadow-ptdf-200"
                            >
                                {isProcessingCap ? <Loader2 size={18} className="animate-spin mr-2"/> : null}
                                {isProcessingCap ? 'Finalizing...' : 'Confirm Capitalization'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="max-w-6xl mx-auto pb-20">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 hover:text-ptdf-600 mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Construction className="text-ptdf-600"/> Work in Progress (WIP)
           </h1>
           <p className="text-slate-500">Track Assets Under Construction (AUC) and Development (AUD).</p>
        </div>
        <button 
            onClick={() => setViewMode('create')}
            className="flex items-center px-4 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-sm"
        >
            <Plus size={18} className="mr-2" /> Create Project
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex gap-4">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-ptdf-500"
            />
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredProjects.map(project => {
            const total = calculateTotalCost(project);
            const percent = Math.min(100, Math.round((total / project.budgetedCost) * 100));

            return (
                <div key={project.id} onClick={() => {setSelectedProject(project); setViewMode('detail');}} className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-ptdf-300 transition-all cursor-pointer overflow-hidden group">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-2 rounded-lg ${project.assetType.includes('Software') ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                {project.assetType.includes('Software') ? <FileText size={24}/> : <Construction size={24}/>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border ${project.status === 'Capitalized' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {project.status}
                            </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-ptdf-600 transition-colors">{project.projectName}</h3>
                        <p className="text-xs text-slate-400 font-mono mb-4">{project.id}</p>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Budget:</span>
                                <span className="font-semibold text-slate-700">₦{project.budgetedCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Accumulated:</span>
                                <span className="font-bold text-ptdf-700">₦{total.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${percent > 100 ? 'bg-red-500' : 'bg-ptdf-500'}`} style={{width: `${percent}%`}}></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>{project.inceptionDate}</span>
                                <span>Target: {project.estimatedCompletionDate}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500 flex items-center"><User size={12} className="mr-1"/> {project.projectManager}</span>
                        <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                    </div>
                </div>
            );
         })}
      </div>
    </div>
  );
};

export default WipManagement;
