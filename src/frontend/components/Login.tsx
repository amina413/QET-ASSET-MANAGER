"use client";

import React, { useState } from 'react';
import { Shield, ArrowRight, Lock, Eye, EyeOff, AtSign } from 'lucide-react';
import { authService, SessionUser } from '@/frontend/services/auth';

interface LoginProps {
  onLogin: (user: SessionUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setIsLoading(true);
    setError(null);

    const result = await authService.login(email.trim().toLowerCase(), password);

    if (result.success) {
      onLogin(result.data);
    } else {
      setError(result.error || 'Authentication failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] relative">
      {/* Left Side - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#081020] relative flex-col justify-between p-16 xl:p-24 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-24">
            <img src="/qet-logo-sidebar.svg" alt="QET Logo" className="h-20 w-auto object-contain" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-8">
            Asset Management<br />&amp; Tracking System
          </h1>
          <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
            Streamline your fixed asset lifecycle, ensure compliance, and
            optimize resource allocation with the official QET platform.
          </p>
        </div>

        <div className="relative z-10 flex items-start space-x-16 border-t border-slate-800 pt-8 mt-12">
          <div>
            <div className="text-2xl font-bold text-white mb-1">99.9%</div>
            <div className="text-sm text-slate-500 font-medium">Uptime Reliability</div>
          </div>
          <div className="w-px h-12 bg-slate-800" />
          <div>
            <div className="text-2xl font-bold text-white mb-1">AES-256</div>
            <div className="text-sm text-slate-500 font-medium">Session Security</div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-20">
        <div className="max-w-[440px] w-full">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center mb-10 pb-6 border-b border-slate-200">
            <div className="bg-[#081020] p-3 rounded-xl shadow-lg border border-slate-800">
              <img src="/qet-logo-sidebar.svg" alt="QET Logo" className="h-8 w-auto object-contain" />
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#081020] mb-3 tracking-tight">Secure Access</h2>
            <p className="text-[#081020]">Enter your credentials to manage the asset ledger.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold text-[#081020] uppercase tracking-widest mb-2">
                CORPORATE EMAIL
              </label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:border-[#081020] focus:ring-1 focus:ring-[#081020] outline-none transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-bold text-[#081020] uppercase tracking-widest mb-2">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:border-[#081020] focus:ring-1 focus:ring-[#081020] outline-none tracking-widest transition-colors placeholder:tracking-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#081020] text-white py-4 rounded-lg font-semibold hover:bg-[#111A2E] transition-all flex items-center justify-center mt-2 group disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-12">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              &copy; {new Date().getFullYear()} Quantum Edge Technologies Ltd. Authorized Access Only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
