
import React, { useState, useEffect } from 'react';
import { MOCK_USERS } from '../constants';
import { User, UserRole } from '../types';
import { Plus, Edit2, Trash2, Shield, X, Loader2, ArrowLeft } from 'lucide-react';
import { canEditUsers, canDeleteUsers } from '../lib/permissions';

interface UserManagementProps {
  currentUser: User;
  onBack?: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    department: '',
    role: 'Custodian' as UserRole
  });

  // Permissions: Auditor read-only; Custodian read-only; Asset Manager can edit but not delete users
  const canModifyUsers = canEditUsers(currentUser.role);
  const canRemoveUsers = canDeleteUsers(currentUser.role);

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

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) return;

    setIsSaving(true);
    setTimeout(() => {
      const userToAdd: User = {
        id: (users.length + 10).toString(), // Mock ID
        name: newUser.name,
        email: newUser.email,
        department: newUser.department || 'General',
        role: newUser.role,
        lastLogin: 'Never'
      };

      setUsers([...users, userToAdd]);
      setIsSaving(false);
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', department: '', role: 'Custodian' }); // Reset form
    }, 1000);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 hover:text-abdc-600 mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User & Role Management</h1>
          <p className="text-slate-500">Manage system access and permissions.</p>
        </div>
        {canModifyUsers && (
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center px-4 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 transition-colors shadow-sm"
          >
            <Plus size={18} className="mr-2" /> Add New User
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
            <Loader2 size={40} className="text-abdc-600 animate-spin mb-4" />
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
                {canModifyUsers && (
                  <th className="p-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                )}
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

                  {canModifyUsers && (
                    <td className="p-5 text-right">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-slate-400 hover:text-abdc-600 hover:bg-abdc-50 rounded-full transition-colors mr-1"
                      >
                        <Edit2 size={16} />
                      </button>
                      {canRemoveUsers && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Edit User Role</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-500 mb-1">User Name</label>
              <input type="text" value={editingUser.name} disabled className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-500" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-500 mb-1">Role</label>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                className="w-full p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-abdc-500 outline-none"
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
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveRole(editingUser.role)}
                disabled={isSaving}
                className="px-4 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 flex items-center"
              >
                {isSaving && <Loader2 size={16} className="animate-spin mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Add New User</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none"
                  placeholder="e.g. j.doe@abdc.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none"
                  placeholder="e.g. Finance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abdc-500 outline-none"
                >
                  <option value="System Admin">System Admin</option>
                  <option value="Asset Manager">Asset Manager</option>
                  <option value="Custodian">Custodian</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isSaving || !newUser.name || !newUser.email}
                className="px-6 py-2 bg-abdc-600 text-white rounded-lg hover:bg-abdc-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={18} className="mr-2" />}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
