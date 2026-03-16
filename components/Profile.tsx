
import React from 'react';
import { User, Asset, AssetHistoryEvent } from '../types';
import { MOCK_ASSET_HISTORY } from '../constants';
import { User as UserIcon, Mail, Building, Shield, Clock, Calendar, ArrowLeft } from 'lucide-react';

interface ProfileProps {
   currentUser: User;
   onBack: () => void;
   assets?: Asset[];
}

const Profile: React.FC<ProfileProps> = ({ currentUser, onBack, assets = [] }) => {
   // Activity from DB history (user matches) or fallback to mock
   const dbActivity = assets.flatMap(a => (a.history || []).filter(h => h.user === currentUser.name));
   const mockActivity = MOCK_ASSET_HISTORY.filter(event =>
      event.user.includes(currentUser.name) || event.user.includes(currentUser.role)
   );
   const myActivity = (dbActivity.length > 0 ? dbActivity : mockActivity)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
            <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
            <p className="text-slate-500">Manage your personal information and view activity.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* User Card */}
            <div className="md:col-span-1">
               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-slate-400 border-4 border-white shadow-lg">
                     {currentUser.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{currentUser.name}</h2>
                  <span className="inline-block mt-2 px-3 py-1 bg-abdc-50 text-abdc-700 text-xs font-bold rounded-full border border-abdc-100">
                     {currentUser.role}
                  </span>

                  <div className="mt-6 space-y-4 text-left">
                     <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                        <Mail size={16} className="text-slate-400" />
                        <span className="truncate">{currentUser.email}</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                        <Building size={16} className="text-slate-400" />
                        <span>{currentUser.department} Department</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                        <Shield size={16} className="text-slate-400" />
                        <span>ID: {currentUser.id}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Activity Feed */}
            <div className="md:col-span-2">
               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                     <Clock size={20} className="mr-2 text-abdc-600" /> Recent Activity
                  </h3>

                  <div className="space-y-6">
                     {myActivity.length > 0 ? (
                        myActivity.map(activity => (
                           <div key={activity.id} className="relative pl-6 border-l-2 border-slate-100 pb-2 last:pb-0">
                              <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-abdc-400 border-2 border-white"></div>
                              <div className="flex justify-between items-start mb-1">
                                 <p className="text-sm font-semibold text-slate-800">{activity.action}</p>
                                 <span className="text--[10px] text-slate-400">{activity.date}</span>
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
