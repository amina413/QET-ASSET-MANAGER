"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, MapPin, Loader2, FolderTree, Layers, Building2, Database, Users as UsersIcon, AlertTriangle } from 'lucide-react';
import { LOCATION_BRANCHES, DEPARTMENT_CODES, LOCATIONS } from '../constants';
import { settingsService } from '../services/settings';
import { assetService } from '../services/assets';
import { User } from '../types';

type Tab = 'departments' | 'custodians' | 'locations' | 'categories' | 'assetTypes' | 'assetClasses';

interface Department {
    id: string;
    name: string;
    code: string;
    location: string;
}

interface Custodian {
    id: string;
    name: string;
    department: string;
    location: string;
    email?: string | null;
    phone?: string | null;
}

interface Location {
    id: string;
    name: string;
    code: string;
}

interface Category {
    id: string;
    name: string;
    code?: string | null;
}

interface AssetType {
    id: string;
    name: string;
    code?: string | null;
    categoryId: string;
    category?: Category;
}

interface CustodianOption {
    id: string;
    name: string;
    assetClassId: string;
}

interface AssetClass {
    id: string;
    name: string;
    code?: string | null;
    custodianOptions: CustodianOption[];
}

interface AdminSettingsProps {
    currentUser: User | null;
}

const AdminSettings = ({ currentUser }: AdminSettingsProps) => {
    const [activeTab, setActiveTab] = useState<Tab>('departments');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [custodians, setCustodians] = useState<Custodian[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
    const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [custodianOptionDeleteId, setCustodianOptionDeleteId] = useState<string | null>(null);
    const [showCustodianOptionModal, setShowCustodianOptionModal] = useState(false);
    const [custodianOptionMode, setCustodianOptionMode] = useState<'perClass' | 'global'>('perClass');
    const [formData, setFormData] = useState<any>({});
    const [isSyncingDepts, setIsSyncingDepts] = useState(false);
    const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
    const [isClearingAll, setIsClearingAll] = useState(false);

    const isSystemAdmin = currentUser?.role === 'System Admin';

    const handleSyncDepartmentsToDatabase = async () => {
        setIsSyncingDepts(true);
        try {
            const result = await settingsService.syncDepartments(LOCATION_BRANCHES, DEPARTMENT_CODES);
            if (result?.success) {
                const added = (result as { added?: number }).added ?? 0;
                alert(added > 0 ? `Added ${added} department(s) to the database.` : 'All reference values are already in the database.');
                loadData();
            } else {
                alert((result as { error?: string }).error || 'Sync failed');
            }
        } catch (e) {
            alert('Sync failed');
        }
        setIsSyncingDepts(false);
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        if (activeTab === 'departments') {
            const [deptRes, locRes] = await Promise.all([settingsService.getDepartments(), settingsService.getLocations()]);
            if (deptRes.success) setDepartments(deptRes.data as Department[]);
            if (locRes.success) setLocations(locRes.data as Location[]);
        } else if (activeTab === 'custodians') {
            const result = await settingsService.getCustodians();
            if (result.success) setCustodians(result.data as Custodian[]);
        } else if (activeTab === 'locations') {
            const result = await settingsService.getLocations();
            if (result.success) setLocations(result.data as Location[]);
        } else if (activeTab === 'categories') {
            const result = await settingsService.getCategories();
            if (result.success) setCategories(result.data as Category[]);
        } else if (activeTab === 'assetTypes') {
            const [typesRes, catRes] = await Promise.all([settingsService.getAssetTypes(), settingsService.getCategories()]);
            if (typesRes.success) setAssetTypes(typesRes.data as AssetType[]);
            if (catRes.success) setCategories(catRes.data as Category[]);
        } else if (activeTab === 'assetClasses') {
            const result = await settingsService.getAssetClasses();
            if (result.success) setAssetClasses(result.data as AssetClass[]);
        }
        setLoading(false);
    };

    const handleAdd = () => {
        setFormData({});
        setEditingId(null);
        setShowAddModal(true);
    };

    const handleEdit = (item: any) => {
        setFormData(item);
        setEditingId(item.id);
        setShowAddModal(true);
    };

    const handleSave = async () => {
        if (activeTab === 'departments') {
            if (!formData.name?.trim() || !formData.code?.trim() || !formData.location?.trim()) {
                alert('Please fill in all required fields (Name, Code, Location)');
                return;
            }
        } else if (activeTab === 'custodians') {
            if (!formData.name?.trim() || !formData.department?.trim() || !formData.location?.trim()) {
                alert('Please fill in all required fields (Name, Department, Location)');
                return;
            }
        } else if (activeTab === 'locations') {
            if (!formData.name?.trim()) {
                alert('Name is required');
                return;
            }
        } else if (activeTab === 'categories') {
            if (!formData.name?.trim()) {
                alert('Name is required');
                return;
            }
        } else if (activeTab === 'assetTypes') {
            if (!formData.categoryId || !formData.name?.trim()) {
                alert('Category and Name are required');
                return;
            }
        } else if (activeTab === 'assetClasses') {
            if (!formData.name?.trim()) {
                alert('Name is required');
                return;
            }
        }

        setLoading(true);
        let result: any;
        try {
            if (activeTab === 'departments') {
                result = editingId ? await settingsService.updateDepartment(editingId, formData) : await settingsService.createDepartment(formData);
            } else if (activeTab === 'custodians') {
                result = editingId ? await settingsService.updateCustodian(editingId, formData) : await settingsService.createCustodian(formData);
            } else if (activeTab === 'locations') {
                result = editingId ? await settingsService.updateLocation(editingId, formData) : await settingsService.createLocation(formData);
            } else if (activeTab === 'categories') {
                result = editingId ? await settingsService.updateCategory(editingId, formData) : await settingsService.createCategory(formData);
            } else if (activeTab === 'assetTypes') {
                result = editingId ? await settingsService.updateAssetType(editingId, formData) : await settingsService.createAssetType(formData);
            } else if (activeTab === 'assetClasses') {
                result = editingId ? await settingsService.updateAssetClass(editingId, formData) : await settingsService.createAssetClass(formData);
            }
            if (result?.success) {
                setShowAddModal(false);
                setFormData({});
                setEditingId(null);
                loadData();
            } else {
                alert(result?.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setLoading(true);
        let result: any;
        if (activeTab === 'departments') result = await settingsService.deleteDepartment(id);
        else if (activeTab === 'custodians') result = await settingsService.deleteCustodian(id);
        else if (activeTab === 'locations') result = await settingsService.deleteLocation(id);
        else if (activeTab === 'categories') result = await settingsService.deleteCategory(id);
        else if (activeTab === 'assetTypes') result = await settingsService.deleteAssetType(id);
        else if (activeTab === 'assetClasses') result = await settingsService.deleteAssetClass(id);
        if (result?.success) {
            setDeleteConfirm(null);
            loadData();
        } else {
            alert(result?.error || 'Delete failed');
        }
        setLoading(false);
    };

    const handleDeleteCustodianOption = async (id: string) => {
        setLoading(true);
        const result = await settingsService.deleteCustodianOption(id);
        if (result?.success) {
            setCustodianOptionDeleteId(null);
            loadData();
        } else {
            alert(result?.error || 'Delete failed');
        }
        setLoading(false);
    };

    const handleAddCustodianOption = (assetClassId: string) => {
        setFormData({ assetClassId, name: '' });
        setEditingId(null);
        setCustodianOptionMode('perClass');
        setShowCustodianOptionModal(true);
    };

    const handleSaveCustodianOption = async () => {
        if (!formData.name?.trim()) {
            alert('Name is required');
            return;
        }
        if (!formData.id && !formData.assetClassId) {
            alert('Asset Class is required when adding an Assigned Custodian.');
            return;
        }
        setLoading(true);
        const result = formData.id
            ? await settingsService.updateCustodianOption(formData.id, { name: formData.name })
            : await settingsService.createCustodianOption({ assetClassId: formData.assetClassId, name: formData.name });
        if (result?.success) {
            setShowCustodianOptionModal(false);
            setFormData({});
            setCustodianOptionMode('perClass');
            loadData();
        } else {
            alert(result?.error || 'Operation failed');
        }
        setLoading(false);
    };

    if (!currentUser || !isSystemAdmin) {
        return (
            <div className="p-8 max-w-2xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                    <h1 className="text-xl font-bold text-slate-800 mb-2">System Admin Only</h1>
                    <p className="text-slate-600">This page is restricted to System Administrators.</p>
                </div>
            </div>
        );
    }

    const tabLabels: Record<Tab, string> = {
        departments: 'Departments/Units',
        custodians: 'Assigned Custodians',
        locations: 'Locations',
        categories: 'Categories',
        assetTypes: 'Asset Types',
        assetClasses: 'Asset Classes',
    };

    const modalLabels: Record<Tab, string> = {
        departments: 'Department',
        custodians: 'Custodian',
        locations: 'Location',
        categories: 'Category',
        assetTypes: 'Asset Type',
        assetClasses: 'Asset Class',
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8 flex items-start gap-4">
                <img
                    src="./qet-logo-transparent.png"
                    alt="QET Logo"
                    className="h-12 w-auto object-contain"
                />
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">System Admin Settings</h1>
                    <p className="text-slate-600">Manage Departments/Units, Asset Classes, Asset Types, Categories, and Locations.</p>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-200 flex-wrap">
                {(['departments', 'custodians', 'locations', 'categories', 'assetTypes', 'assetClasses'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-medium transition-colors relative ${activeTab === tab ? 'text-qet-600' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            {tab === 'departments' && <Building2 size={18} />}
                            {tab === 'custodians' && <UsersIcon size={18} />}
                            {tab === 'locations' && <MapPin size={18} />}
                            {tab === 'categories' && <FolderTree size={18} />}
                            {tab === 'assetTypes' && <Layers size={18} />}
                            {tab === 'assetClasses' && <FolderTree size={18} />}
                            {tabLabels[tab]}
                        </div>
                        {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-qet-600" />}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-slate-800">{tabLabels[activeTab]}</h2>
                    <div className="flex items-center gap-2">
                        {activeTab === 'assetClasses' && (
                            <button
                                type="button"
                                onClick={() => { setFormData({ name: '', assetClassId: '' }); setEditingId(null); setShowCustodianOptionModal(true); setCustodianOptionMode('global'); }}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
                            >
                                <Plus size={18} /> Add Assigned Custodian
                            </button>
                        )}
                        <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 transition-colors">
                            <Plus size={18} /> Add New
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="animate-spin text-qet-600" size={32} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {activeTab === 'departments' && (
                            <>
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-4 font-semibold text-slate-700">Name</th>
                                            <th className="text-left p-4 font-semibold text-slate-700">Code</th>
                                            <th className="text-left p-4 font-semibold text-slate-700">Location</th>
                                            <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {departments.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">
                                                    No departments yet. Click &quot;Add New&quot; to create one, or import default departments below.
                                                </td>
                                            </tr>
                                        ) : (
                                            departments.map((dept) => (
                                                <tr key={dept.id} className="hover:bg-slate-50">
                                                    <td className="p-4 font-medium text-slate-800">{dept.name}</td>
                                                    <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-700">{dept.code}</span></td>
                                                    <td className="p-4 text-slate-600">{dept.location}</td>
                                                    <td className="p-4 text-right">
                                                        <button type="button" onClick={() => handleEdit(dept)} className="p-1.5 text-slate-500 hover:text-qet-600 hover:bg-qet-50 rounded transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                        <button type="button" onClick={() => setDeleteConfirm(dept.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1" title="Delete"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                    <button
                                        type="button"
                                        onClick={handleSyncDepartmentsToDatabase}
                                        disabled={isSyncingDepts}
                                        className="text-sm text-slate-600 hover:text-qet-600 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Database size={14} />
                                        {isSyncingDepts ? 'Importing…' : 'Import default departments from reference'}
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'custodians' && (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-700">Name</th>
                                        <th className="text-left p-4 font-semibold text-slate-700">Department</th>
                                        <th className="text-left p-4 font-semibold text-slate-700">Location</th>
                                        <th className="text-left p-4 font-semibold text-slate-700">Email</th>
                                        <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {custodians.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                                                No custodians yet. Click "Add New" to create one.
                                            </td>
                                        </tr>
                                    ) : (
                                        custodians.map((cust) => (
                                            <tr key={cust.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-medium text-slate-800">{cust.name}</td>
                                                <td className="p-4 text-slate-600">{cust.department}</td>
                                                <td className="p-4 text-slate-600">{cust.location}</td>
                                                <td className="p-4 text-sm text-slate-500">{cust.email || '-'}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleEdit(cust)} className="p-1.5 text-slate-500 hover:text-qet-600 hover:bg-qet-50 rounded transition-colors mr-1"><Edit2 size={16} /></button>
                                                    <button onClick={() => setDeleteConfirm(cust.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'locations' && (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-700">Name</th>
                                        <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {locations.map((loc) => (
                                        <tr key={loc.id} className="hover:bg-slate-50">
                                            <td className="p-4">{loc.name}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleEdit(loc)} className="text-qet-600 hover:text-qet-800 mr-3"><Edit2 size={16} /></button>
                                                <button onClick={() => setDeleteConfirm(loc.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'categories' && (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-700">Name</th>
                                        <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categories.map((cat) => (
                                        <tr key={cat.id} className="hover:bg-slate-50">
                                            <td className="p-4">{cat.name}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleEdit(cat)} className="text-qet-600 hover:text-qet-800 mr-3"><Edit2 size={16} /></button>
                                                <button onClick={() => setDeleteConfirm(cat.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'assetTypes' && (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-700">Category</th>
                                        <th className="text-left p-4 font-semibold text-slate-700">Asset Type Name</th>
                                        <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {assetTypes.map((at) => (
                                        <tr key={at.id} className="hover:bg-slate-50">
                                            <td className="p-4">{at.category?.name ?? at.categoryId}</td>
                                            <td className="p-4">{at.name}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleEdit(at)} className="text-qet-600 hover:text-qet-800 mr-3"><Edit2 size={16} /></button>
                                                <button onClick={() => setDeleteConfirm(at.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'assetClasses' && (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-700">Asset Class</th>
                                        <th className="text-left p-4 font-semibold text-slate-700">Assigned Custodians</th>
                                        <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {assetClasses.map((ac) => (
                                        <tr key={ac.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-medium align-top">{ac.name}</td>
                                            <td className="p-4 align-top">
                                                <ul className="space-y-1">
                                                    {ac.custodianOptions?.map((opt) => (
                                                        <li key={opt.id} className="flex items-center justify-between gap-2">
                                                            <span>{opt.name}</span>
                                                            <span>
                                                                <button onClick={() => { setFormData({ id: opt.id, assetClassId: ac.id, name: opt.name }); setShowCustodianOptionModal(true); }} className="text-qet-600 hover:text-qet-800"><Edit2 size={14} /></button>
                                                                <button onClick={() => setCustodianOptionDeleteId(opt.id)} className="text-red-600 hover:text-red-800 ml-1"><Trash2 size={14} /></button>
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <button type="button" onClick={() => handleAddCustodianOption(ac.id)} className="mt-2 text-sm text-qet-600 hover:text-qet-700 flex items-center gap-1">
                                                    <Plus size={14} /> Add custodian
                                                </button>
                                            </td>
                                            <td className="p-4 text-right align-top">
                                                <button onClick={() => handleEdit(ac)} className="text-qet-600 hover:text-qet-800 mr-3"><Edit2 size={16} /></button>
                                                <button onClick={() => setDeleteConfirm(ac.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} {modalLabels[activeTab]}</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            {activeTab === 'departments' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" placeholder="e.g. Tax, Advisory" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Code <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" maxLength={5} placeholder="e.g. TAX, ADV" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Location <span className="text-red-500">*</span></label>
                                        <select value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required>
                                            <option value="">Select location</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">Use the same location name as in Asset Registration.</p>
                                    </div>
                                </>
                            )}
                            {activeTab === 'custodians' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Department <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.department || ''} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Location <span className="text-red-500">*</span></label>
                                        <select value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required>
                                            <option value="">Select location</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Email (Optional)</label>
                                        <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Phone (Optional)</label>
                                        <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
                                    </div>
                                </>
                            )}
                            {activeTab === 'locations' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required />
                                </div>
                            )}
                            {activeTab === 'categories' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required />
                                </div>
                            )}
                            {activeTab === 'assetTypes' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
                                        <select value={formData.categoryId || ''} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required>
                                            <option value="">Select category</option>
                                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">When adding an Asset Type, the Category must be selected.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Asset Type Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required />
                                    </div>
                                </>
                            )}
                            {activeTab === 'assetClasses' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Asset Class Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" placeholder="e.g. General Purpose, Cluster" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Code (optional)</label>
                                        <input type="text" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleSave} className="flex-1 bg-qet-600 text-white py-2 rounded-lg hover:bg-qet-700 flex items-center justify-center gap-2"><Save size={18} /> Save</button>
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custodian Option modal */}
            {showCustodianOptionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{formData.id ? 'Edit' : 'Add'} Assigned Custodian</h3>
                            <button onClick={() => { setShowCustodianOptionModal(false); setFormData({}); setCustodianOptionMode('perClass'); }}><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            {custodianOptionMode === 'global' && !formData.id ? (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Asset Class <span className="text-red-500">*</span></label>
                                    <select value={formData.assetClassId || ''} onChange={(e) => setFormData({ ...formData, assetClassId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" required>
                                        <option value="">Select Asset Class</option>
                                        {assetClasses.map((ac) => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">When adding an Assigned Custodian, the Asset Class must be selected.</p>
                                </div>
                            ) : formData.assetClassId && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Asset Class</label>
                                    <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
                                        {assetClasses.find(ac => ac.id === formData.assetClassId)?.name ?? '—'}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-qet-500" placeholder="e.g. HR/Admin" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleSaveCustodianOption} className="flex-1 bg-qet-600 text-white py-2 rounded-lg hover:bg-qet-700 flex items-center justify-center gap-2"><Save size={18} /> Save</button>
                            <button onClick={() => { setShowCustodianOptionModal(false); setFormData({}); setCustodianOptionMode('perClass'); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
                        <p className="text-slate-600 mb-6">Are you sure you want to delete this item?</p>
                        <div className="flex gap-3">
                            <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {custodianOptionDeleteId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
                        <p className="text-slate-600 mb-6">Remove this assigned custodian option?</p>
                        <div className="flex gap-3">
                            <button onClick={() => handleDeleteCustodianOption(custodianOptionDeleteId)} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Delete</button>
                            <button onClick={() => setCustodianOptionDeleteId(null)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fresh start: clear all assets and WIP */}
            <div className="mt-10 p-6 rounded-xl border-2 border-red-200 bg-red-50/50">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-600" /> Fresh start
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                    Permanently delete all assets from the register and clear Work in Progress. Use this to start with empty data. Users and settings (locations, categories, etc.) are not affected.
                </p>
                <button
                    type="button"
                    onClick={() => setShowClearAllConfirm(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                >
                    Clear all assets and WIP
                </button>
            </div>

            {showClearAllConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Clear everything?</h3>
                        <p className="text-slate-600 mb-6">
                            This will delete all assets from the database and the app will reload with empty assets and empty Work in Progress. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={async () => {
                                    setIsClearingAll(true);
                                    const result = await assetService.clearAll();
                                    setIsClearingAll(false);
                                    setShowClearAllConfirm(false);
                                    if (result?.success) {
                                        window.location.href = '/';
                                    } else {
                                        alert(result?.error || 'Failed to clear assets');
                                    }
                                }}
                                disabled={isClearingAll}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isClearingAll ? <Loader2 size={18} className="animate-spin" /> : null}
                                {isClearingAll ? 'Clearing…' : 'Yes, clear all'}
                            </button>
                            <button onClick={() => setShowClearAllConfirm(false)} disabled={isClearingAll} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
