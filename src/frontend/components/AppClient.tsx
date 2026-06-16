"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from './ErrorBoundary';
import { useToast } from './Toast';
import GeminiAssistantLauncher from './GeminiAssistantLauncher';
import { View, Asset } from '@/shared/types';
import type { SessionUser } from '@/frontend/services/auth';
import { setUnauthorizedHandler } from '@/frontend/services/api-client';
import { canAccessView } from '@/shared/view-access';
import { hasPermission } from '@/shared/permissions';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import Login from './Login';
import { Menu, Loader2 } from 'lucide-react';
import { authService } from '@/frontend/services/auth';
import { assetService } from '@/frontend/services/assets';
import type { DbUser } from '@/frontend/services/users';
import { userService } from '@/frontend/services/users';

const AssetForm = dynamic(() => import('./AssetForm'), { ssr: false });
const AssetLookup = dynamic(() => import('./AssetLookup'), { ssr: false });
const Reports = dynamic(() => import('./Reports'), { ssr: false });
const UserManagement = dynamic(() => import('./UserManagement'), { ssr: false });
const WipManagement = dynamic(() => import('./WipManagement'), { ssr: false });
const Profile = dynamic(() => import('./Profile'), { ssr: false });
const AdminSettings = dynamic(() => import('./AdminSettings'), { ssr: false });
const Audit = dynamic(() => import('./Audit'), { ssr: false });

export default function AppClient() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [initialAssetId, setInitialAssetId] = useState<string | undefined>(undefined);

  // Live data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [dataError, setDataError] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshAssets = useCallback(async () => {
    const result = await assetService.getAll();
    if (result.success) {
      setAssets(result.data);
    } else {
      console.error('Failed to load assets:', result.error);
      setDataError(result.error);
      toast('Failed to refresh assets', 'error');
    }
  }, [toast]);

  const refreshUsers = useCallback(async () => {
    const result = await userService.getAll();
    if (result.success) {
      setUsers(result.data);
    } else {
      console.error('Failed to load users:', result.error);
      setDataError(result.error);
      toast('Failed to refresh users', 'error');
    }
  }, [toast]);

  const loadInitialData = useCallback(async (isCancelled?: () => boolean) => {
    setIsDataLoading(true);
    const [assetResult, userResult] = await Promise.all([assetService.getAll(), userService.getAll()]);
    if (isCancelled?.()) return;

    if (assetResult.success) {
      setAssets(assetResult.data);
    } else {
      console.error('Failed to load assets:', assetResult.error);
      setDataError(assetResult.error);
      toast('Failed to refresh assets', 'error');
    }

    if (userResult.success) {
      setUsers(userResult.data);
    } else {
      console.error('Failed to load users:', userResult.error);
      setDataError(userResult.error);
      toast('Failed to refresh users', 'error');
    }

    setIsDataLoading(false);
  }, [refreshAssets, refreshUsers]);

  // Restore session from HttpOnly cookie via /api/auth/me
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCurrentUser(null);
      setAssets([]);
      setUsers([]);
      setCurrentView(View.DASHBOARD);
      setDashboardSearchTerm('');
      toast('Your session has expired. Please sign in again.', 'error');
    });

    const restoreSession = async () => {
      const result = await authService.me();
      if (result.success) {
        setCurrentUser(result.data);
      }
      setIsRestoringSession(false);
    };
    restoreSession();
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  // Load data once user is known
  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      loadInitialData(() => cancelled);
      // Apply saved dark mode preference
      if (typeof window !== 'undefined') {
        const theme = localStorage.getItem('qet_theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      }
    }
    return () => {
      cancelled = true;
    };
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
    if (!currentUser) return;
    if (!canAccessView(currentUser.role, view)) {
      toast('You do not have permission to access that area.', 'error');
      setCurrentView(View.DASHBOARD);
      return;
    }
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
    lastLogin: currentUser.lastLogin ?? new Date().toISOString(),
  };

  const renderView = () => {
    if (!canAccessView(currentUser.role, currentView)) {
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
        return <AdminSettings currentUser={userForComponents} onBack={handleBackToDashboard} />;
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
        {dataError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <div className="font-semibold">Data failed to load</div>
            <div>{dataError}</div>
            <button
              type="button"
              onClick={() => {
                setDataError(null);
                loadInitialData();
              }}
              className="mt-2 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        {isDataLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <ErrorBoundary key={currentView}>{renderView()}</ErrorBoundary>
        )}
        <GeminiAssistantLauncher assets={assets} canUseAI={hasPermission(currentUser.role, 'view_all_reports')} />
      </main>
    </div>
  );
}
