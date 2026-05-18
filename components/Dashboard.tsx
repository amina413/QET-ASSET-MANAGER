
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ASSET_DISTRIBUTION, CATEGORY_CODES } from '../constants';
import { ArrowUpRight, AlertCircle, DollarSign, Package, Search, Bell, ChevronDown, LogOut, User as UserIcon, X, MapPin, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { User, View, Asset } from '../types';

export interface DashboardNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  assetId?: string;
}

// Palette: Brand Blues
const COLORS = ['#1e3a8a', '#2563eb', '#0ea5e9', '#60a5fa', '#bfdbfe'];

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} wk ago`;
  return `${Math.floor(diffDays / 30)} mo ago`;
}

interface DashboardProps {
  currentUser: User;
  onNavigateToSearch: (term: string) => void;
  onLogout: () => void;
  onNavigate?: (view: View) => void;
  onNavigateToAsset?: (assetId: string) => void;
  assets?: Asset[];
}

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend?: string; color: string; onClick?: () => void }> = ({ title, value, icon, trend, color, onClick }) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); } : undefined}
    className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
  >
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
      <div className="flex items-center text-xs text-qet-600 font-medium">
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
  onNavigateToAsset,
  assets = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Sliding Chart State
  const [valuationView, setValuationView] = useState<'location' | 'category'>('location');
  const [isPaused, setIsPaused] = useState(false);

  // Notification read state (which notification ids user has marked read)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

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

  const isCustodian = currentUser.role === 'Custodian';
  const relevantAssets = isCustodian
    ? (assets || []).filter(a => a.location.includes("Abuja"))
    : (assets || []);

  // Build notifications from real asset data
  const notifications = useMemo((): DashboardNotification[] => {
    const list: DashboardNotification[] = [];
    // Maintenance Due: status Maintenance or condition F1/F2
    relevantAssets
      .filter(a => a.status === 'Maintenance' || (a.conditionCode && ['F1', 'F2'].includes(a.conditionCode)))
      .forEach(a => {
        list.push({
          id: `maintenance-${a.id}`,
          title: 'Maintenance Due',
          desc: `${a.name} (${a.productId}) requires attention.`,
          time: 'Due',
          unread: !readIds.has(`maintenance-${a.id}`),
          assetId: a.id
        });
      });
    // Pending Transfer
    relevantAssets
      .filter(a => a.status === 'Pending Transfer')
      .forEach(a => {
        list.push({
          id: `pending-${a.id}`,
          title: 'Pending Transfer',
          desc: `${a.name} (${a.productId}) is awaiting transfer.`,
          time: 'Pending',
          unread: !readIds.has(`pending-${a.id}`),
          assetId: a.id
        });
      });
    // Recently registered (by registrationDate, newest first, max 5)
    const withDate = relevantAssets
      .filter(a => a.registrationDate)
      .sort((a, b) => (new Date(b.registrationDate!).getTime() - new Date(a.registrationDate!).getTime()))
      .slice(0, 5);
    withDate.forEach(a => {
      list.push({
        id: `recent-${a.id}`,
        title: 'New Asset Registered',
        desc: `${a.name} (${a.productId}) added.`,
        time: formatRelativeTime(a.registrationDate),
        unread: !readIds.has(`recent-${a.id}`),
        assetId: a.id
      });
    });
    return list;
  }, [relevantAssets, readIds]);

  const handleMarkAllRead = () => {
    setReadIds(prev => new Set([...prev, ...notifications.map(n => n.id)]));
  };

  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    if (onNavigate) onNavigate(View.ASSET_MANAGEMENT);
  };

  const handleNotificationClick = (notif: DashboardNotification) => {
    setReadIds(prev => new Set([...prev, notif.id]));
    setShowNotifications(false);
    if (notif.assetId && onNavigateToAsset) onNavigateToAsset(notif.assetId);
    else if (onNavigate) onNavigate(View.ASSET_MANAGEMENT);
  };

  const handlePendingAction = () => {
    if (onNavigate) onNavigate(View.ASSET_MANAGEMENT);
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  // --- Calculations ---
  const totalAssets = relevantAssets.length;
  const totalValue = relevantAssets.reduce((sum, a) => sum + a.acquisitionCost, 0);
  const netBookValue = relevantAssets.reduce((sum, a) => sum + a.netBookValue, 0);
  // Pending Approval: assets with status containing "pending" (e.g. Pending Transfer)
  const pendingApprovalAssets = relevantAssets.filter(
    a => (a.status || '').toLowerCase().includes('pending')
  );
  const pendingApproval = pendingApprovalAssets.length;

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

  // Calculate actual asset distribution by category (for the pie chart)
  const assetByCategoryData = useMemo(() => {
    const categoryCounts = relevantAssets.reduce((acc, asset) => {
      const category = asset.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = relevantAssets.length;
    if (total === 0) return [];

    return Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      value: count,
      percentage: Math.round((count / total) * 100)
    })).sort((a, b) => b.value - a.value);
  }, [relevantAssets]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000000) return `₦${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    return `₦${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <img
            src="./qet-logo-transparent.png"
            alt="QET Logo"
            className="h-12 w-auto object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isCustodian ? 'Jurisdiction Dashboard' : 'Executive Dashboard'}
            </h1>
            <p className="text-slate-500 text-sm">
              Welcome back, <span className="font-semibold text-qet-600">{currentUser.name}</span>.
              {isCustodian && <span className="ml-2 inline-flex items-center text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600"><MapPin size={10} className="mr-1" /> Abuja HQ Zone</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 relative">
          <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Quick search assets..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-qet-500 w-64 bg-white"
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
                      className="text-xs text-qet-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">No notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNotificationClick(notif)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotificationClick(notif); } }}
                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${notif.unread ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm font-semibold ${notif.unread ? 'text-slate-900' : 'text-slate-600'}`}>{notif.title}</span>
                          {notif.unread && <span className="w-2 h-2 bg-accent-500 rounded-full flex-shrink-0"></span>}
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{notif.desc}</p>
                        <span className="text-xs text-slate-400">{notif.time}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t border-slate-50">
                  <button
                    onClick={handleViewAllNotifications}
                    className="text-xs font-medium text-qet-600 hover:text-qet-800"
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
              <div className="w-8 h-8 rounded-full bg-qet-100 flex items-center justify-center text-qet-700 font-bold text-xs border border-qet-200">
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
          icon={<Package className="text-qet-600" size={24} />}
          trend={isCustodian ? "+2 this month" : "+12 this month"}
          color="bg-qet-600"
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
          icon={<div className="font-bold text-qet-800">NBV</div>}
          color="bg-qet-800"
        />
        <MetricCard
          title="Pending Approval"
          value={pendingApproval.toString()}
          icon={<AlertCircle className="text-red-500" size={24} />}
          color="bg-red-500"
          onClick={pendingApproval > 0 ? handlePendingAction : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quantity Distribution Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Asset by Category</h3>
          {assetByCategoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              No assets found
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetByCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => {
                      if (!name) return '';
                      // Case-insensitive lookup
                      const match = Object.keys(CATEGORY_CODES).find(k => k.toLowerCase() === name.toLowerCase());
                      const abbrev = match ? CATEGORY_CODES[match] : name;
                      return `${abbrev}: ${((percent ?? 0) * 100).toFixed(0)}%`;
                    }}
                  >
                    {assetByCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value} assets (${((props.payload?.percent ?? 0) * 100).toFixed(0)}%)`,
                      props.payload?.name ?? name
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value, entry: any) => `${entry.payload.name} (${entry.payload.value})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
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
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-semibold text-qet-700 animate-fadeIn">
                {valuationView === 'location' ? 'Total Asset Value by Location' : 'Total Asset Value by Category'}
              </h4>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">{valuationView === 'location' ? '1 of 2' : '2 of 2'}</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuationView === 'location' ? valueByLocationData : valueByCategoryData} margin={{ bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9 }} 
                    interval={0} 
                    angle={-45} 
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₦${val / 1000000}M`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="value"
                    fill={valuationView === 'location' ? '#2563eb' : '#0ea5e9'}
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
          {pendingApproval > 0 && (
            <button
              onClick={handlePendingAction}
              className="text-sm text-qet-600 hover:text-qet-800 font-medium"
            >
              View All
            </button>
          )}
        </div>

        <div className="space-y-4">
          {pendingApproval === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No pending approvals. All caught up.</p>
          ) : (
            pendingApprovalAssets.slice(0, 5).map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-qet-50 flex items-center justify-center text-qet-700 font-bold text-sm border border-qet-100">
                    {(asset.name || asset.productId).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{asset.name}</p>
                    <p className="text-xs text-slate-500">{asset.productId} • {asset.status} • {asset.location}</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateToAsset ? onNavigateToAsset(asset.id) : handlePendingAction()}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 hover:border-qet-300 transition-all"
                >
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
