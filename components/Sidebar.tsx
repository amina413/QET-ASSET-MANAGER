
import React from 'react';
import { View, User } from '../types';
import { LayoutDashboard, PlusCircle, ScanLine, FileBarChart, Users, Menu, X, LogOut, AlertTriangle } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  currentUser: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isMobileOpen, setIsMobileOpen, currentUser, onLogout }) => {
  // Define base menu items
  const allMenuItems = [
    { view: View.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian', 'Auditor'] },
    // Custodians can now register assets (within their jurisdiction logic handled in component)
    { view: View.ASSET_REGISTRATION, label: 'Register Asset', icon: <PlusCircle size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian'] }, 
    { view: View.ASSET_LOOKUP, label: 'Scan & Lookup', icon: <ScanLine size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian', 'Auditor'] },
    { view: View.REPORT_ISSUE, label: 'Report Issue', icon: <AlertTriangle size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian'] },
    { view: View.REPORTS, label: 'Reports', icon: <FileBarChart size={20} />, roles: ['System Admin', 'Asset Manager', 'Auditor', 'Custodian'] },
    // Custodians view User Admin (read-only handled in component)
    { view: View.USER_MANAGEMENT, label: 'User Admin', icon: <Users size={20} />, roles: ['System Admin', 'Asset Manager', 'Auditor', 'Custodian'] }, 
  ];

  // Filter items based on current user role
  const menuItems = allMenuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <>
      {/* Mobile Header Overlay */}
      <div className={`fixed inset-0 bg-slate-900 bg-opacity-50 z-40 transition-opacity md:hidden ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileOpen(false)}></div>

      {/* Sidebar Container */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-slate-900 text-slate-300 w-64 transform transition-transform z-50 flex flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Logo Area */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
           <div className="flex items-center space-x-3">
             <img 
               src="./PTDF-logo.png" 
               alt="PTDF Logo" 
               className="w-8 h-8 object-contain"
             />
             <span className="text-xl font-bold text-white tracking-tight">PTDF Asset</span>
           </div>
           <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white">
             <X size={24} />
           </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => (
              <li key={item.view}>
                <button
                  onClick={() => {
                    setCurrentView(item.view);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    currentView === item.view 
                    ? 'bg-ptdf-600 text-white shadow-lg shadow-ptdf-900/50' 
                    : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 p-2 bg-slate-800 rounded-lg mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 p-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;