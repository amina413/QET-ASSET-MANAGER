
"use client";

import React, { useState, useEffect } from 'react';
import { View, User, Asset } from '../types';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import AssetForm from './AssetForm';
import AssetLookup from './AssetLookup';
import Reports from './Reports';
import UserManagement from './UserManagement';
import WipManagement from './WipManagement';
import GeminiAssistant from './GeminiAssistant';
import Profile from './Profile';
import AdminSettings from './AdminSettings';
import Audit from './Audit';
import Login from './Login';
import { Menu, Loader2 } from 'lucide-react';

const SESSION_KEY = 'abdc_user';

interface AppClientProps {
    initialAssets: Asset[];
    initialUsers: any[];
}

export default function AppClient({ initialAssets, initialUsers }: AppClientProps) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isRestoringSession, setIsRestoringSession] = useState(true);
    const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
    const [initialAssetId, setInitialAssetId] = useState<string | undefined>(undefined);

    useEffect(() => {
        try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
            if (stored) {
                const user = JSON.parse(stored) as User;
                if (user?.id && user?.email) setCurrentUser(user);
            }
        } catch {
            // Ignore invalid stored data
        }
        setIsRestoringSession(false);
    }, []);

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setCurrentView(View.DASHBOARD);
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        } catch {
            // Ignore if localStorage unavailable
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setCurrentView(View.DASHBOARD);
        setDashboardSearchTerm('');
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch {
            // Ignore
        }
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

    const renderView = () => {
        if (!currentUser) return <Login onLogin={handleLogin} />;

        switch (currentView) {
            case View.DASHBOARD:
                return (
                    <Dashboard
                        currentUser={currentUser}
                        onNavigateToSearch={handleDashboardSearch}
                        onLogout={handleLogout}
                        onNavigate={(view) => setCurrentView(view)}
                        onNavigateToAsset={handleNavigateToAsset}
                        assets={initialAssets}
                    />
                );
            case View.ASSET_REGISTRATION:
                return <AssetForm onBack={handleBackToDashboard} currentUser={currentUser} />;
            case View.ASSET_LOOKUP:
                return <AssetLookup
                    initialSearchTerm={dashboardSearchTerm}
                    initialAssetId={initialAssetId}
                    onBack={handleBackToDashboard}
                    assets={initialAssets}
                    currentUser={currentUser}
                    users={initialUsers}
                />;
            case View.ASSET_MANAGEMENT:
                return <AssetLookup
                    initialSearchTerm={dashboardSearchTerm}
                    initialAssetId={initialAssetId}
                    managementMode={true}
                    onBack={handleBackToDashboard}
                    assets={initialAssets}
                    currentUser={currentUser}
                    users={initialUsers}
                />;
            case View.WIP_MANAGEMENT:
                return <WipManagement onBack={handleBackToDashboard} />;
            case View.REPORTS:
                return <Reports onBack={handleBackToDashboard} onNavigateToAsset={handleNavigateToAsset} assets={initialAssets} />;
            case View.USER_MANAGEMENT:
                return <UserManagement currentUser={currentUser} onBack={handleBackToDashboard} />;
            case View.AUDIT:
                return <Audit onBack={handleBackToDashboard} currentUser={currentUser} assets={initialAssets} />;
            case View.PROFILE:
                return <Profile currentUser={currentUser} onBack={handleBackToDashboard} assets={initialAssets} />;
            case View.SETTINGS:
                return <AdminSettings currentUser={currentUser} />;
            default:
                return <Dashboard
                    currentUser={currentUser}
                    onNavigateToSearch={handleDashboardSearch}
                    onLogout={handleLogout}
                    onNavigate={(view) => setCurrentView(view)}
                    onNavigateToAsset={handleNavigateToAsset}
                    assets={initialAssets}
                />;
        }
    };

    if (isRestoringSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-abdc-600 animate-spin" />
            </div>
        );
    }

    if (!currentUser) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar
                currentView={currentView}
                setCurrentView={(view) => {
                    setDashboardSearchTerm('');
                    setInitialAssetId(undefined);
                    setCurrentView(view);
                }}
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                currentUser={currentUser}
                onLogout={handleLogout}
            />

            <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto relative">
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="md:hidden absolute top-4 right-4 p-2 text-slate-600 bg-white rounded-md shadow-sm z-30"
                >
                    <Menu size={24} />
                </button>

                {renderView()}

                <GeminiAssistant assets={initialAssets} />
            </main>
        </div>
    );
}
