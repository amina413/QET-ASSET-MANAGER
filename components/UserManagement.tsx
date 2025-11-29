
import React, { useState, useEffect } from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';
import { Plus, Edit2, Trash2, Shield, X, Loader2 } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Simulate initial data fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsers(MOCK_USERS);
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this user?')) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setUsers(users.filter(u => u.id !== id));
        setIsLoading(false);
      }, 800);
    }
  };

  const handleSaveRole = (newRole: string) => {
    if (editingUser) {
      setIsSaving(true);
      // Simulate API call
      setTimeout(() => {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, role: newRole as any } : u));
        setIsSaving(false);
        setEditingUser(null);
      }, 1000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">User & Role Management</h1>
           <p className="text-slate-500">Manage system access and permissions.</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors shadow-sm">
          <Plus size={18} className="mr-2" /> Add New User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
            <Loader2 size={40} className="text-ptdf-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Loading users...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse animate-fadeIn">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Login</th>
                <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold mr-3">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-sm text-slate-600">{user.department}</td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${user.role === 'System Admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'Asset Manager' ? 'bg-accent-100 text-accent-700' :
                        user.role === 'Auditor' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}
                    `}>
                      <Shield size={12} className="mr-1" />
                      {user.role}
                    </span>
                  </td>
                  <td className="p-5 text-sm text-slate-500">{user.lastLogin}</td>
                  <td className="p-5 text-right space-x-2">
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="p-2 text-slate-400 hover:text-ptdf-600 hover:bg-ptdf-50 rounded-full transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scaleIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Edit User Role</h3>
              <button 
                onClick={() => !isSaving && setEditingUser(null)} 
                className="text-slate-400 hover:text-slate-600"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-500 mb-1">User Name</label>
              <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
                {editingUser.name}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Role</label>
              <select 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ptdf-500 outline-none bg-white"
                defaultValue={editingUser.role}
                id="role-select"
              >
                <option value="System Admin">System Admin</option>
                <option value="Asset Manager">Asset Manager</option>
                <option value="Custodian">Custodian</option>
                <option value="Auditor">Auditor</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                   const select = document.getElementById('role-select') as HTMLSelectElement;
                   handleSaveRole(select.value);
                }}
                className="px-4 py-2 bg-ptdf-600 text-white rounded-lg hover:bg-ptdf-700 transition-colors flex items-center"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
