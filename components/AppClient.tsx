"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { View, Asset } from '../types';
import type { SessionUser } from '../services/auth';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import AssetForm from './AssetForm';
import AssetLookup from './AssetLookup';
import Reports from './Reports';
import UserManagement from './UserManagement';
import WipManagement from './WipManagement';
import Profile from './Profile';
import AdminSettings from './AdminSettings';
import Audit from './Audit';
import Login from './Login';
import { Menu, Loader2 } from 'lucide-react';
import { authService } from '../services/auth';
import { assetService } from '../services/assets';
import { userService } from '../services/users';

const GeminiAssistant = dynamic(() => import('./GeminiAssistant'), { ssr: false });

export default function AppClient() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [initialAssetId, setInitialAssetId] = useState<string | undefined>(undefined);

  // Live data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<unknown[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const refreshAssets = useCallback(async () => {
    const result = await assetService.getAll();
    if (result.success) setAssets(result.data);
  }, []);

  const refreshUsers = useCallback(async () => {
    const result = await userService.getAll();
    if (result.success) setUsers(result.data);
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsDataLoading(true);
    await Promise.all([refreshAssets(), refreshUsers()]);
    setIsDataLoading(false);
  }, [refreshAssets, refreshUsers]);

  // Restore session from HttpOnly cookie via /api/auth/me
  useEffect(() => {
    const restoreSession = async () => {
      const result = await authService.me();
      if (result.success) {
        setCurrentUser(result.data);
      }
      setIsRestoringSession(false);
    };
    restoreSession();
  }, []);

  // Load data once user is known
  useEffect(() => {
    if (currentUser) {
      loadInitialData();
      // Apply saved dark mode preference
      if (typeof window !== 'undefined') {
        const theme = localStorage.getItem('qet_theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      }
    }
  }, [currentUser, loadInitialData]);

  const handleLogin = (user: SessionUser) => {
    setCurrentUser(user);
    setCurrentView(View.DASHBOARD);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setAssets([]);
    setUsers([]);
    setCurrentView(View.DASHBOARD);
    setDashboardSearchTerm('');
  };

  const handleDashboardSearch = (term: string) => {
    setDashboardSearchTerm(term);
    setInitialAssetId(undefined);
    setCurrentView(View.ASSET_LOOKUP);
  };

  const handleNavigateToAsset = (assetId: string) => {
    setInitialAssetId(assetId);
    setDashboardSearchTerm('');
    setCurrentView(View.ASSET_MANAGEMENT);
  };

  const handleBackToDashboard = () => {
    setCurrentView(View.DASHBOARD);
    setDashboardSearchTerm('');
    setInitialAssetId(undefined);
  };

  const handleNav = (view: View) => {
    setDashboardSearchTerm('');
    setInitialAssetId(undefined);
    setCurrentView(view);
  };

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const userForComponents = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    department: currentUser.department,
    role: currentUser.role,
    lastLogin: new Date().toISOString(),
  };

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return (
          <Dashboard
            currentUser={userForComponents}
            onNavigateToSearch={handleDashboardSearch}
            onLogout={handleLogout}
            onNavigate={handleNav}
            onNavigateToAsset={handleNavigateToAsset}
            assets={assets}
          />
        );
      case View.ASSET_REGISTRATION:
        return (
          <AssetForm
            onBack={handleBackToDashboard}
            currentUser={userForComponents}
            onSuccess={refreshAssets}
          />
        );
      case View.ASSET_LOOKUP:
        return (
          <AssetLookup
            initialSearchTerm={dashboardSearchTerm}
            initialAssetId={initialAssetId}
            onBack={handleBackToDashboard}
            assets={assets}
            currentUser={userForComponents}
            users={users}
            onDataChange={refreshAssets}
          />
        );
      case View.ASSET_MANAGEMENT:
        return (
          <AssetLookup
            initialSearchTerm={dashboardSearchTerm}
            initialAssetId={initialAssetId}
            managementMode={true}
            onBack={handleBackToDashboard}
            assets={assets}
            currentUser={userForComponents}
            users={users}
            onDataChange={refreshAssets}
          />
        );
      case View.WIP_MANAGEMENT:
        return <WipManagement onBack={handleBackToDashboard} />;
      case View.REPORTS:
        return <Reports onBack={handleBackToDashboard} onNavigateToAsset={handleNavigateToAsset} assets={assets} />;
      case View.USER_MANAGEMENT:
        return <UserManagement currentUser={userForComponents} onBack={handleBackToDashboard} onDataChange={refreshUsers} />;
      case View.AUDIT:
        return <Audit onBack={handleBackToDashboard} currentUser={userForComponents} assets={assets} />;
      case View.PROFILE:
        return <Profile currentUser={userForComponents} onBack={handleBackToDashboard} assets={assets} />;
      case View.SETTINGS:
        return <AdminSettings currentUser={userForComponents} />;
      default:
        return (
          <Dashboard
            currentUser={userForComponents}
            onNavigateToSearch={handleDashboardSearch}
            onLogout={handleLogout}
            onNavigate={handleNav}
            onNavigateToAsset={handleNavigateToAsset}
            assets={assets}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar
        currentView={currentView}
        setCurrentView={handleNav}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        currentUser={userForComponents}
        onLogout={handleLogout}
      />
      <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto relative">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden absolute top-4 right-4 p-2 text-slate-600 bg-white rounded-md shadow-sm z-30"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        {isDataLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          renderView()
        )}
        <GeminiAssistant assets={assets} />
      </main>
    </div>
  );
}
