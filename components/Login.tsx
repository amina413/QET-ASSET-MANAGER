
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Shield, ArrowRight, Lock, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const MOCK_LOGIN_USERS: Record<UserRole, User> = {
  'System Admin': { id: '1', name: 'Amina Yusuf', email: 'admin@ptdf.gov.ng', department: 'IT', role: 'System Admin', lastLogin: new Date().toISOString() },
  'Asset Manager': { id: '2', name: 'Tunde Bakare', email: 'manager@ptdf.gov.ng', department: 'Finance', role: 'Asset Manager', lastLogin: new Date().toISOString() },
  'Custodian': { id: '3', name: 'Emeka Okafor', email: 'emeka@ptdf.gov.ng', department: 'Operations', role: 'Custodian', lastLogin: new Date().toISOString() },
  'Auditor': { id: '4', name: 'Chioma Obi', email: 'audit@ptdf.gov.ng', department: 'Internal Audit', role: 'Auditor', lastLogin: new Date().toISOString() },
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Asset Manager');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network request
    setTimeout(() => {
      onLogin(MOCK_LOGIN_USERS[selectedRole]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side - Brand Visuals */}
      {/* Changed hidden lg:flex to hidden md:flex to show on tablets/smaller laptops */}
      <div className="hidden md:flex md:w-1/2 bg-ptdf-900 relative overflow-hidden flex-col justify-between p-12 text-white">

        {/* Background Asset Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/asset-2.png"
            alt="PTDF Building"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient Overlay to ensure text readability matching brand colors */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20"></div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob z-0"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-ptdf-400 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000 z-0"></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-8">
            <img
              src="/PTDF-logo.jpeg"
              alt="PTDF Logo"
              className="w-20 h-20 object-contain drop-shadow-2xl bg-white/10 rounded-full p-1 backdrop-blur-sm"
            />
            <span className="text-3xl font-bold tracking-tight text-white drop-shadow-md">PTDF Asset</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6 drop-shadow-lg">
            Secure Asset Management & <span className="text-accent-400">Tracking System</span>
          </h1>
          <p className="text-lg text-ptdf-50 max-w-md drop-shadow-md font-medium">
            Streamline your fixed asset lifecycle, ensure compliance, and optimize resource allocation with the official PTDF platform.
          </p>
        </div>

        <div className="relative z-10 text-sm text-ptdf-100/80">
          &copy; {new Date().getFullYear()} Petroleum Technology Development Fund. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 relative z-20">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-xl border border-slate-100">

          {/* Mobile Branding (Visible only when left panel is hidden) */}
          <div className="md:hidden text-center mb-8 border-b border-slate-100 pb-6">
            <img
              src="/PTDF-logo.jpeg"
              alt="PTDF Logo"
              className="w-16 h-16 mx-auto mb-4 object-contain"
            />
            <h1 className="text-2xl font-bold text-slate-800">PTDF Asset</h1>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Please sign in to access your dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select User Role (Demo)</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ptdf-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="System Admin">System Admin</option>
                  <option value="Asset Manager">Asset Manager</option>
                  <option value="Custodian">Custodian</option>
                  <option value="Auditor">Auditor</option>
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ArrowRight size={16} className="text-slate-400 rotate-90" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 ml-1">
                * In production, this would be Email/Password.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Identity Verification</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={MOCK_LOGIN_USERS[selectedRole].email}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value="password123"
                  readOnly
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-ptdf-600 text-white py-3 rounded-xl font-bold hover:bg-ptdf-700 transition-all shadow-lg shadow-ptdf-200 flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>Sign In <ArrowRight size={20} className="ml-2" /></>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="#" className="text-sm text-ptdf-600 hover:text-ptdf-800 font-medium">Forgot Password?</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
