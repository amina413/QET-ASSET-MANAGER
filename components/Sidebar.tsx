import React from 'react';
import { View, User } from '../types';
import { LayoutDashboard, PlusCircle, ScanLine, FileBarChart, Users, Menu, X, LogOut, Briefcase, Construction, Settings, ClipboardCheck } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  currentUser: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isMobileOpen, setIsMobileOpen, currentUser, onLogout }) => {
  const allMenuItems = [
    { view: View.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian', 'Auditor'] },
    { view: View.AUDIT, label: 'Start Audit', icon: <ClipboardCheck size={20} />, roles: ['Auditor'] },
    { view: View.ASSET_REGISTRATION, label: 'Register Asset', icon: <PlusCircle size={20} />, roles: ['System Admin', 'Asset Manager'] },
    { view: View.WIP_MANAGEMENT, label: 'Work in Progress', icon: <Construction size={20} />, roles: ['System Admin', 'Asset Manager'] },
    { view: View.ASSET_LOOKUP, label: 'Scan & Lookup', icon: <ScanLine size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian', 'Auditor'] },
    { view: View.ASSET_MANAGEMENT, label: 'Asset Management', icon: <Briefcase size={20} />, roles: ['System Admin', 'Asset Manager', 'Custodian'] },
    { view: View.REPORTS, label: 'Reports', icon: <FileBarChart size={20} />, roles: ['System Admin', 'Asset Manager', 'Auditor', 'Custodian'] },
    { view: View.USER_MANAGEMENT, label: 'User Admin', icon: <Users size={20} />, roles: ['System Admin', 'Asset Manager', 'Auditor', 'Custodian'] },
    { view: View.SETTINGS, label: 'System Admin Settings', icon: <Settings size={20} />, roles: ['System Admin'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <>
      <div className={`fixed inset-0 bg-slate-900 bg-opacity-50 z-40 transition-opacity md:hidden ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileOpen(false)}></div>

      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-qet-900 dark:bg-[#081020] text-slate-300 w-64 transform transition-transform z-50 flex flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        <div className="p-6 flex items-center justify-center border-b border-slate-800/60 relative">
          <img
            src="./qet-logo-sidebar.png"
            alt="Quantum Edge Technologies Ltd. Logo"
            className="h-20 w-auto object-contain"
          />
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden absolute right-6 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => (
              <li key={item.view}>
                <button
                  onClick={() => {
                    setCurrentView(item.view);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === item.view
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
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

        <div className="p-4 border-t border-slate-800/60">
          <button 
            onClick={() => {
              setCurrentView(View.PROFILE);
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 p-2 rounded-lg mb-2 text-left transition-colors border ${currentView === View.PROFILE ? 'bg-slate-800 border-slate-700' : 'hover:bg-slate-800/50 border-transparent'}`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
            </div>
          </button>
          
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 p-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors"
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