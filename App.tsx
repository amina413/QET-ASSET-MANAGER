
import React, { useState } from 'react';
import { View, User } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AssetForm from './components/AssetForm';
import AssetLookup from './components/AssetLookup';
import Reports from './components/Reports';
import UserManagement from './components/UserManagement';
import WipManagement from './components/WipManagement';
import GeminiAssistant from './components/GeminiAssistant';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Login from './components/Login';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');

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
    setCurrentView(View.ASSET_LOOKUP);
  };

  const handleBackToDashboard = () => {
    setCurrentView(View.DASHBOARD);
    setDashboardSearchTerm('');
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
          />
        );
      case View.ASSET_REGISTRATION:
        return <AssetForm onBack={handleBackToDashboard} />;
      case View.ASSET_LOOKUP:
        return <AssetLookup initialSearchTerm={dashboardSearchTerm} onBack={handleBackToDashboard} />;
      case View.ASSET_MANAGEMENT:
        return <AssetLookup initialSearchTerm={dashboardSearchTerm} managementMode={true} onBack={handleBackToDashboard} />;
      case View.WIP_MANAGEMENT:
        return <WipManagement onBack={handleBackToDashboard} />;
      case View.REPORTS:
        return <Reports onBack={handleBackToDashboard} />;
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
          if (view !== View.ASSET_LOOKUP && view !== View.ASSET_MANAGEMENT) setDashboardSearchTerm('');
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

        <GeminiAssistant />
      </main>
    </div>
  );
};

export default App;
