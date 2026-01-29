
"use client";

import React, { useState } from 'react';
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
import Settings from './Settings';
import Login from './Login';
import { Menu } from 'lucide-react';

interface AppClientProps {
    initialAssets: Asset[];
    initialUsers: any[];
}

export default function AppClient({ initialAssets, initialUsers }: AppClientProps) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
    const [initialAssetId, setInitialAssetId] = useState<string | undefined>(undefined);

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setCurrentView(View.DASHBOARD);
    };

    const handleLogout = () => {
        setCurrentUser(null);
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
                />;
            case View.ASSET_MANAGEMENT:
                return <AssetLookup
                    initialSearchTerm={dashboardSearchTerm}
                    initialAssetId={initialAssetId}
                    managementMode={true}
                    onBack={handleBackToDashboard}
                    assets={initialAssets}
                />;
            case View.WIP_MANAGEMENT:
                return <WipManagement onBack={handleBackToDashboard} />;
            case View.REPORTS:
                return <Reports onBack={handleBackToDashboard} onNavigateToAsset={handleNavigateToAsset} assets={initialAssets} />;
            case View.USER_MANAGEMENT:
                return <UserManagement currentUser={currentUser} onBack={handleBackToDashboard} />;
            case View.PROFILE:
                return <Profile currentUser={currentUser} onBack={handleBackToDashboard} />;
            case View.SETTINGS:
                return <Settings onBack={handleBackToDashboard} />;
            default:
                return <Dashboard
                    currentUser={currentUser}
                    onNavigateToSearch={handleDashboardSearch}
                    onLogout={handleLogout}
                    onNavigate={(view) => setCurrentView(view)}
                    assets={initialAssets}
                />;
        }
    };

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
