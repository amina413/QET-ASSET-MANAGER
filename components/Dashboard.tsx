
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ASSET_DISTRIBUTION } from '../constants';
import { ArrowUpRight, AlertCircle, DollarSign, Package, Search, Bell, ChevronDown, LogOut, User as UserIcon, Settings, X, MapPin, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { User, View, Asset } from '../types';

// Palette: Brand Greens + Gold Accent
const COLORS = ['#006B3E', '#005532', '#FFCC00', '#22c55e', '#bbf7d0'];

interface DashboardProps {
  currentUser: User;
  onNavigateToSearch: (term: string) => void;
  onLogout: () => void;
  onNavigate?: (view: View) => void;
  assets?: Asset[];
}

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend?: string; color: string }> = ({ title, value, icon, trend, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
        {icon}
      </div>
    </div>
    {trend && (
      <div className="flex items-center text-xs text-abdc-600 font-medium">
        <ArrowUpRight size={14} className="mr-1" />
        {trend}
      </div>
    )}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onNavigateToSearch,
  onLogout,
  onNavigate,
  assets = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Sliding Chart State
  const [valuationView, setValuationView] = useState<'location' | 'category'>('location');
  const [isPaused, setIsPaused] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Asset Transfer Request', desc: 'IT Dept requested transfer of 5 Laptops.', time: '2 hrs ago', unread: true },
    { id: 2, title: 'Maintenance Due', desc: 'Generator Set A requires servicing.', time: '5 hrs ago', unread: true },
    { id: 3, title: 'New Asset Registered', desc: 'Toyota Hilux (ABDC-8821) added.', time: '1 day ago', unread: false },
  ]);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-slide effect for Valuation Chart
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setValuationView(prev => prev === 'location' ? 'category' : 'location');
    }, 6000); // Switch every 6 seconds
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onNavigateToSearch(searchTerm);
    }
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    if (onNavigate) onNavigate(View.PROFILE);
  };

  const handlePendingAction = () => {
    if (onNavigate) onNavigate(View.ASSET_MANAGEMENT);
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const isCustodian = currentUser.role === 'Custodian';
  const relevantAssets = isCustodian
    ? (assets || []).filter(a => a.location.includes("Abuja"))
    : (assets || []);

  // --- Calculations ---
  const totalAssets = relevantAssets.length;
  const totalValue = relevantAssets.reduce((sum, a) => sum + a.acquisitionCost, 0);
  const netBookValue = relevantAssets.reduce((sum, a) => sum + a.netBookValue, 0);
  const pendingDisposal = isCustodian ? 2 : 45;

  // Calculate Total Current Depreciation (Annual Expense)
  const totalCurrentDepreciation = relevantAssets.reduce((sum, asset) => {
    const life = asset.usefulLife || 5;
    const salvage = asset.salvageValue || 0;
    // Simple Straight Line: (Cost - Salvage) / Life
    const annualDepr = (asset.acquisitionCost - salvage) / life;
    return sum + (annualDepr > 0 ? annualDepr : 0);
  }, 0);

  // Aggregate Data for Sliding Chart (Value by Location)
  const valueByLocationData = Object.values(relevantAssets.reduce((acc, asset) => {
    if (!acc[asset.location]) acc[asset.location] = { name: asset.location, value: 0 };
    acc[asset.location].value += asset.netBookValue; // Using NBV for "Value"
    return acc;
  }, {} as Record<string, { name: string, value: number }>));

  // Aggregate Data for Sliding Chart (Value by Category)
  const valueByCategoryData = Object.values(relevantAssets.reduce((acc, asset) => {
    if (!acc[asset.category]) acc[asset.category] = { name: asset.category, value: 0 };
    acc[asset.category].value += asset.netBookValue;
    return acc;
  }, {} as Record<string, { name: string, value: number }>));

  const formatCurrency = (val: number) => {
    if (val >= 1000000000) return `₦${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    return `₦${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isCustodian ? 'Jurisdiction Dashboard' : 'Executive Dashboard'}
          </h1>
          <p className="text-slate-500 text-sm">
            Welcome back, <span className="font-semibold text-abdc-600">{currentUser.name}</span>.
            {isCustodian && <span className="ml-2 inline-flex items-center text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600"><MapPin size={10} className="mr-1" /> Abuja HQ Zone</span>}
          </p>
        </div>

        <div className="flex items-center space-x-4 relative">
          <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Quick search assets..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-abdc-500 w-64 bg-white"
            />
          </form>

          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 relative text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-fadeIn">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-abdc-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${notif.unread ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-semibold ${notif.unread ? 'text-slate-900' : 'text-slate-600'}`}>{notif.title}</span>
                        {notif.unread && <span className="w-2 h-2 bg-accent-500 rounded-full"></span>}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{notif.desc}</p>
                      <span className="text-xs text-slate-400">{notif.time}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center border-t border-slate-50">
                  <button
                    onClick={handleViewAllNotifications}
                    className="text-xs font-medium text-abdc-600 hover:text-abdc-800"
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 pl-4 border-l border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-abdc-100 flex items-center justify-center text-abdc-700 font-bold text-xs border border-abdc-200">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-700 leading-tight">{currentUser.name}</p>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{currentUser.role}</p>
              </div>
              <ChevronDown size={14} className="text-slate-400 hidden md:block" />
            </div>

            {showUserMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-fadeIn overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50">
                  <p className="text-sm font-bold text-slate-800">{currentUser.name}</p>
                  <p className="text-xs text-slate-500">{currentUser.email}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { if (onNavigate) onNavigate(View.PROFILE); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center"
                  >
                    <UserIcon size={16} className="mr-2" /> My Profile
                  </button>
                  <button
                    onClick={() => { if (onNavigate) onNavigate(View.SETTINGS); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center"
                  >
                    <Settings size={16} className="mr-2" /> Account Settings
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center"
                  >
                    <LogOut size={16} className="mr-2" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Assets"
          value={totalAssets.toLocaleString()}
          icon={<Package className="text-abdc-600" size={24} />}
          trend={isCustodian ? "+2 this month" : "+12 this month"}
          color="bg-abdc-600"
        />
        <MetricCard
          title="Acquisition Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="text-accent-600" size={24} />}
          trend="+5.2% YoY"
          color="bg-accent-500"
        />
        <MetricCard
          title="Net Book Value"
          value={formatCurrency(netBookValue)}
          icon={<div className="font-bold text-abdc-800">NBV</div>}
          color="bg-abdc-800"
        />
        <MetricCard
          title="Pending Disposal"
          value={pendingDisposal.toString()}
          icon={<AlertCircle className="text-red-500" size={24} />}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quantity Distribution Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 text-transform: lowercase">asset by category</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ASSET_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {ASSET_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sliding Valuation Display */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase">Total Current Depreciation</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalCurrentDepreciation)} <span className="text-xs text-slate-400 font-normal">/ year</span></h3>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-1 rounded hover:bg-white text-slate-500"
                title={isPaused ? "Play" : "Pause"}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button
                onClick={() => setValuationView(prev => prev === 'location' ? 'category' : 'location')}
                className="p-1 rounded hover:bg-white text-slate-500"
              >
                {valuationView === 'location' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-abdc-700 animate-fadeIn">
                {valuationView === 'location' ? 'Total Asset Value by Location' : 'Total Asset Value by Category'}
              </h4>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">{valuationView === 'location' ? '1 of 2' : '2 of 2'}</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuationView === 'location' ? valueByLocationData : valueByCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₦${val / 1000000}M`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="value"
                    fill={valuationView === 'location' ? '#006B3E' : '#FFCC00'}
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Pending Approvals</h3>
          <button
            onClick={handlePendingAction}
            className="text-sm text-abdc-600 hover:text-abdc-800 font-medium"
          >
            View All
          </button>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-abdc-50 flex items-center justify-center text-abdc-700 font-bold text-sm border border-abdc-100">AT</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Asset Transfer Request #{2020 + i}</p>
                  <p className="text-xs text-slate-500">Requested by IT Department • 2 hours ago</p>
                </div>
              </div>
              <button
                onClick={handlePendingAction}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 hover:border-abdc-300 transition-all"
              >
                Review
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
