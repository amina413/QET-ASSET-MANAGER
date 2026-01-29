
import React, { useState } from 'react';
import { Bell, Lock, Eye, Monitor, Save, Check, ArrowLeft } from 'lucide-react';

interface SettingsProps {
   onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
   const [activeTab, setActiveTab] = useState('general');
   const [notifications, setNotifications] = useState({
      email: true,
      push: true,
      weeklyReport: false
   });

   const [isSaved, setIsSaved] = useState(false);

   const handleSave = () => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
   };

   return (
      <div className="max-w-4xl mx-auto pb-20 animate-fadeIn">
         <button
            onClick={onBack}
            className="flex items-center text-sm text-slate-500 hover:text-abdc-600 mb-6 transition-colors group"
         >
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
         </button>

         <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
            <p className="text-slate-500">Manage your preferences and security settings.</p>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-50 p-4 border-r border-slate-100">
               <div className="space-y-1">
                  <button
                     onClick={() => setActiveTab('general')}
                     className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-white text-abdc-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                     <Monitor size={18} />
                     <span>General</span>
                  </button>
                  <button
                     onClick={() => setActiveTab('security')}
                     className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-white text-abdc-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                     <Lock size={18} />
                     <span>Security</span>
                  </button>
                  <button
                     onClick={() => setActiveTab('notifications')}
                     className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-white text-abdc-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                     <Bell size={18} />
                     <span>Notifications</span>
                  </button>
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8">
               {activeTab === 'general' && (
                  <div className="space-y-6 animate-fadeIn">
                     <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Display Settings</h2>

                     <div className="grid grid-cols-1 gap-6">
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-2">Theme Preference</label>
                           <div className="flex gap-4">
                              <div className="border-2 border-abdc-500 rounded-lg p-3 bg-white cursor-pointer w-32 shadow-sm">
                                 <div className="h-12 bg-slate-100 rounded mb-2"></div>
                                 <p className="text-center text-xs font-bold text-abdc-700">Light Mode</p>
                              </div>
                              <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 cursor-not-allowed w-32 opacity-50">
                                 <div className="h-12 bg-slate-700 rounded mb-2"></div>
                                 <p className="text-center text-xs text-slate-400">Dark Mode</p>
                              </div>
                           </div>
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                           <select className="w-full max-w-xs p-2 bg-white border border-slate-300 rounded-lg text-sm">
                              <option>English (UK)</option>
                              <option>English (US)</option>
                              <option>French</option>
                              <option>Hausa</option>
                              <option>Yoruba</option>
                              <option>Igbo</option>
                           </select>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'security' && (
                  <div className="space-y-6 animate-fadeIn">
                     <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Password & Security</h2>

                     <div className="space-y-4 max-w-md">
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                           <input type="password" placeholder="••••••••" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm" />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                           <input type="password" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm" />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                           <input type="password" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm" />
                        </div>
                     </div>

                     <div className="pt-4">
                        <button className="text-abdc-600 text-sm font-medium hover:underline">Enable Two-Factor Authentication</button>
                     </div>
                  </div>
               )}

               {activeTab === 'notifications' && (
                  <div className="space-y-6 animate-fadeIn">
                     <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Notification Preferences</h2>

                     <div className="space-y-4">
                        <label className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                           <div>
                              <p className="text-sm font-bold text-slate-800">Email Alerts</p>
                              <p className="text-xs text-slate-500">Receive system updates via email.</p>
                           </div>
                           <div className={`w-10 h-5 rounded-full relative transition-colors ${notifications.email ? 'bg-abdc-600' : 'bg-slate-300'}`} onClick={() => setNotifications({ ...notifications, email: !notifications.email })}>
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.email ? 'left-5.5' : 'left-0.5'}`}></div>
                           </div>
                        </label>

                        <label className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                           <div>
                              <p className="text-sm font-bold text-slate-800">Browser Push Notifications</p>
                              <p className="text-xs text-slate-500">Get notified about transfers immediately.</p>
                           </div>
                           <div className={`w-10 h-5 rounded-full relative transition-colors ${notifications.push ? 'bg-abdc-600' : 'bg-slate-300'}`} onClick={() => setNotifications({ ...notifications, push: !notifications.push })}>
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.push ? 'left-5.5' : 'left-0.5'}`}></div>
                           </div>
                        </label>

                        <label className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                           <div>
                              <p className="text-sm font-bold text-slate-800">Weekly Summary Report</p>
                              <p className="text-xs text-slate-500">A weekly digest of asset activities.</p>
                           </div>
                           <div className={`w-10 h-5 rounded-full relative transition-colors ${notifications.weeklyReport ? 'bg-abdc-600' : 'bg-slate-300'}`} onClick={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}>
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.weeklyReport ? 'left-5.5' : 'left-0.5'}`}></div>
                           </div>
                        </label>
                     </div>
                  </div>
               )}

               <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                  <button
                     onClick={handleSave}
                     className="px-6 py-2 bg-abdc-600 text-white rounded-lg font-bold hover:bg-abdc-700 transition-colors flex items-center"
                  >
                     {isSaved ? <Check size={18} className="mr-2" /> : <Save size={18} className="mr-2" />}
                     {isSaved ? 'Saved!' : 'Save Changes'}
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Settings;
