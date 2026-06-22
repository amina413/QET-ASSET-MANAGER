"use client";

import React, { useState, useEffect } from 'react';
import { User, Asset, AssetHistoryEvent } from '@/types';
import { Mail, Building, Shield, Clock, Calendar, ArrowLeft, Moon } from 'lucide-react';
import { authService } from '@/services/auth';

interface ProfileProps {
   currentUser: User;
   onBack: () => void;
   assets?: Asset[];
}

const Profile: React.FC<ProfileProps> = ({ currentUser, onBack, assets = [] }) => {
   const [isDark, setIsDark] = useState(false);
   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [isChangingPassword, setIsChangingPassword] = useState(false);
   const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

   useEffect(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
   }, []);

   const toggleTheme = () => {
      if (typeof window !== 'undefined') {
         const isNowDark = document.documentElement.classList.toggle('dark');
         setIsDark(isNowDark);
         localStorage.setItem('qet_theme', isNowDark ? 'dark' : 'light');
      }
   };

   const myActivity = assets
      .flatMap(a => (a.history || []).filter(h => h.userId === currentUser.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

   const handleChangePassword = async (event: React.FormEvent) => {
      event.preventDefault();
      setIsChangingPassword(true);
      setPasswordMessage(null);
      const result = await authService.changePassword(currentPassword, newPassword);
      setIsChangingPassword(false);
      if (result.success) {
         setCurrentPassword('');
         setNewPassword('');
         setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      } else {
         setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password.' });
      }
   };

   return (
      <div className="max-w-4xl mx-auto pb-20 animate-fadeIn">
         <button
            onClick={onBack}
            className="flex items-center text-sm text-slate-500 hover:text-qet-600 mb-6 transition-colors group"
         >
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
         </button>

         <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
            <p className="text-slate-500">Manage your personal information and application settings.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="md:col-span-1 space-y-6">
               
               {/* User Card */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-slate-400 border-4 border-white shadow-lg">
                     {currentUser.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{currentUser.name}</h2>
                  <span className="inline-block mt-2 px-3 py-1 bg-qet-50 text-qet-700 text-xs font-bold rounded-full border border-qet-100">
                     {currentUser.role}
                  </span>

                  <div className="mt-6 space-y-4 text-left">
                     <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg border border-transparent">
                        <Mail size={16} className="text-slate-400" />
                        <span className="truncate">{currentUser.email}</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg border border-transparent">
                        <Building size={16} className="text-slate-400" />
                        <span>{currentUser.department} Department</span>
                     </div>
                  </div>
               </div>

               {/* Appearance Settings */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                     <Moon size={16} className="mr-2 text-slate-400" />
                     Appearance
                  </h3>
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-slate-600 font-medium">Dark Mode</span>
                     <button 
                        onClick={toggleTheme}
                        aria-pressed={isDark}
                        aria-label="Toggle dark mode"
                        className={`w-12 h-6 rounded-full transition-colors relative ${isDark ? 'bg-qet-500' : 'bg-slate-200'}`}
                     >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0'}`}></div>
                     </button>
                  </div>
               </div>

               <form onSubmit={handleChangePassword} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                     <Shield size={16} className="mr-2 text-slate-400" />
                     Change Password
                  </h3>
                  <div className="space-y-3">
                     <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        required
                     />
                     <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        minLength={8}
                        required
                     />
                     {passwordMessage && (
                        <p className={`text-xs ${passwordMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`} role="status">
                           {passwordMessage.text}
                        </p>
                     )}
                     <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="w-full bg-qet-600 text-white rounded-lg px-3 py-2 text-sm font-semibold hover:bg-qet-700 disabled:opacity-50"
                     >
                        {isChangingPassword ? 'Changing...' : 'Update password'}
                     </button>
                  </div>
               </form>

            </div>

            {/* Activity Feed */}
            <div className="md:col-span-2">
               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                     <Clock size={20} className="mr-2 text-qet-600" /> Recent Activity
                  </h3>

                  <div className="space-y-6">
                     {myActivity.length > 0 ? (
                        myActivity.map(activity => (
                           <div key={activity.id} className="relative pl-6 border-l-2 border-slate-100 pb-2 last:pb-0">
                              <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-qet-400 border-2 border-white"></div>
                              <div className="flex justify-between items-start mb-1">
                                 <p className="text-sm font-semibold text-slate-800">{activity.action}</p>
                                 <span className="text-xs text-slate-400">{activity.date}</span>
                              </div>
                              <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-50">{activity.details}</p>
                           </div>
                        ))
                     ) : (
                        <div className="text-center py-10 text-slate-400">
                           <Calendar size={32} className="mx-auto mb-2 opacity-20" />
                           <p>No recent system activity recorded.</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Profile;
