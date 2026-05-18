import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Shield, ArrowRight, Lock, Eye, EyeOff, AtSign, Briefcase, Fingerprint, HelpCircle } from 'lucide-react';
import { loginUser } from '../app/actions/users';

interface LoginProps {
  onLogin: (user: User) => void;
}

const MOCK_LOGIN_USERS: Record<UserRole, User> = {
  'System Admin': { id: '1', name: 'Amina Yusuf', email: 'admin@qet.com', department: 'IT', role: 'System Admin', lastLogin: new Date().toISOString() },
  'Asset Manager': { id: '2', name: 'Tunde Bakare', email: 'manager@qet.com', department: 'Finance', role: 'Asset Manager', lastLogin: new Date().toISOString() },
  'Custodian': { id: '3', name: 'Emeka Okafor', email: 'emeka@qet.com', department: 'Operations', role: 'Custodian', lastLogin: new Date().toISOString() },
  'Auditor': { id: '4', name: 'Chioma Obi', email: 'audit@qet.com', department: 'Internal Audit', role: 'Auditor', lastLogin: new Date().toISOString() },
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Asset Manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update email and password when role changes
  React.useEffect(() => {
    const demoUser = MOCK_LOGIN_USERS[selectedRole];
    setEmail(demoUser.email);
    setPassword('password123'); // Auto-fill default password
  }, [selectedRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await loginUser(email, password);

    if (result.success && result.user) {
      onLogin({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        department: result.user.department,
        role: result.user.role
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ') as any,
        lastLogin: result.user.lastLogin.toISOString()
      });
    } else {
      setError(result.error || "Authentication failed. Please ensure the database is seeded.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] relative">
      {/* Left Side - Brand Visuals */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#081020] relative flex-col justify-between p-16 xl:p-24 text-white overflow-hidden">
        
        {/* Subtle grid/dot background */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        ></div>
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>

        {/* Top Header */}
        <div className="relative z-10">
          <div className="mb-24">
            <img src="/qet-logo-sidebar.png" alt="QET Logo" className="h-20 w-auto object-contain" />
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-8">
            Asset Management<br/>&amp; Tracking System
          </h1>
          <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
            Streamline your fixed asset lifecycle, ensure<br/>
            compliance, and optimize resource allocation with<br/>
            the official QET platform.
          </p>
        </div>

        {/* Bottom Stats */}
        <div className="relative z-10 flex items-start space-x-16 border-t border-slate-800 pt-8 mt-12 w-max">
          <div>
            <div className="text-2xl font-bold text-white mb-1">99.9%</div>
            <div className="text-sm text-slate-500 font-medium">Uptime Reliability</div>
          </div>
          <div className="w-px h-12 bg-slate-800"></div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">256-bit</div>
            <div className="text-sm text-slate-500 font-medium">Vault Security</div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-20">
        
        {/* Floating Help Button */}
        <button className="absolute bottom-8 right-8 w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl flex items-center justify-center text-slate-900 shadow-sm transition-colors">
          <HelpCircle size={20} className="fill-slate-900 text-slate-200" />
        </button>

        <div className="max-w-[440px] w-full">
          {/* Mobile Branding (Visible only when left panel is hidden) */}
          <div className="lg:hidden flex items-center mb-10 pb-6 border-b border-slate-200">
             <div className="bg-[#081020] p-3 rounded-xl shadow-lg border border-slate-800">
                 <img src="/qet-logo-sidebar.png" alt="QET Logo" className="h-8 w-auto object-contain" />
             </div>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#081020] mb-3 tracking-tight">Secure Access</h2>
            <p className="text-[#081020]">Enter your credentials to manage the ledger.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Integrated Role Selector */}
            <div>
              <label className="block text-[11px] font-bold text-[#081020] uppercase tracking-widest mb-2">ACCESS ROLE</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-white text-slate-900 dark:text-slate-900 border border-slate-200 dark:border-slate-300 rounded-lg focus:border-[#081020] focus:ring-1 focus:ring-[#081020] outline-none appearance-none cursor-pointer transition-colors"
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
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#081020] uppercase tracking-widest mb-2">CORPORATE EMAIL</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-white text-slate-900 dark:text-slate-900 border border-slate-200 dark:border-slate-300 rounded-lg focus:border-[#081020] focus:ring-1 focus:ring-[#081020] outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-[#081020] uppercase tracking-widest">PASSWORD</label>
                <a href="#" className="flex text-[12px] font-bold text-blue-600 hover:text-blue-800 transition-colors">Reset access?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-white dark:bg-white text-slate-900 dark:text-slate-900 border border-slate-200 dark:border-slate-300 rounded-lg focus:border-[#081020] focus:ring-1 focus:ring-[#081020] outline-none tracking-widest transition-colors placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-400"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberTerminal}
                onChange={(e) => setRememberTerminal(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#081020] focus:ring-[#081020]"
              />
              <label htmlFor="remember" className="ml-2.5 text-sm text-[#081020] font-medium">
                Remember this terminal
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#081020] text-white py-4 rounded-lg font-semibold hover:bg-[#111A2E] transition-all flex items-center justify-center mt-2 group"
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
                <>Sign In to Dashboard <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          {/* Alternative Auth divider */}
          <div className="relative mt-10 mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="px-3 bg-[#F8F9FA]">OR AUTHENTICATE WITH</span>
            </div>
          </div>

          {/* Alternative Auth Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            <button type="button" className="flex items-center justify-center py-3.5 px-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="w-5 h-5 bg-blue-600/10 rounded flex items-center justify-center mr-2">
                <Briefcase className="text-blue-600" size={14} />
              </span>
              <span className="text-sm font-semibold text-slate-800">Workspace</span>
            </button>
            <button type="button" className="flex items-center justify-center py-3.5 px-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Fingerprint className="text-slate-400 mr-2" size={18} />
              <span className="text-sm font-semibold text-slate-800">Biometrics</span>
            </button>
          </div>

          <div className="text-center">
             <p className="text-xs text-slate-400 font-medium tracking-wide">
               &copy; 2026 Quantum Edge Technologies Ltd. Authorized Access Only.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
