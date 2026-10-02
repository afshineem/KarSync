import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { usePermissions } from '../context/AuthContext';
import { db } from '../db/db';
import { supabase } from '../services/realtimeSync';
import { Users, UserPlus, X, Edit, Trash2, Power, ShieldAlert, Key } from 'lucide-react';
import UserFormModal from './UserFormModal';

export default function UsersManagementModal({ isOpen, onClose }) {
  const { language } = useLanguage();
  const { currentUser, hasPermission } = usePermissions();
  
  const [usersList, setUsersList] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (isOpen && currentUser?.workspace_id) {
      loadData();
    }
  }, [isOpen, currentUser]);

  const loadData = async () => {
    try {
      // Offline priority
      const ws = await db.workspaces?.get(currentUser.workspace_id);
      if (ws) setWorkspace(ws);
      
      const list = await db.app_users?.where('workspace_id').equals(currentUser.workspace_id).toArray() || [];
      setUsersList(list);

      // Background sync from Supabase
      if (navigator.onLine) {
        const { data: wsData } = await supabase.from('workspaces').select('*').eq('id', currentUser.workspace_id).single();
        if (wsData) {
          setWorkspace(wsData);
          if (db.workspaces) await db.workspaces.put(wsData);
        }
        const { data: uData } = await supabase.from('app_users').select('*').eq('workspace_id', currentUser.workspace_id);
        if (uData) {
          setUsersList(uData);
          if (db.app_users) await db.app_users.bulkPut(uData);
        }
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSaveUser = async (formData) => {
    try {
      if (!selectedUser && workspace && usersList.length >= workspace.max_users_limit) {
        alert('سقف کاربران پکیج شما تکمیل شده است. برای افزودن کاربر جدید، پکیج خود را ارتقا دهید یا کاربری را غیرفعال کنید.');
        return;
      }

      const userData = {
        ...formData,
        id: selectedUser ? selectedUser.id : generateUUID(),
        workspace_id: currentUser.workspace_id,
        is_active: selectedUser ? selectedUser.is_active : true,
        session_version: selectedUser ? selectedUser.session_version : 1,
        created_at: selectedUser ? selectedUser.created_at : new Date().toISOString()
      };

      if (formData.password) {
        userData.password_hash = formData.password; // Note: In production this should be hashed on the server
      } else if (selectedUser) {
        userData.password_hash = selectedUser.password_hash;
      }

      delete userData.password;

      // Save to local
      if (db.app_users) await db.app_users.put(userData);

      // Save to remote
      if (navigator.onLine) {
        await supabase.from('app_users').upsert(userData);
      }

      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('خطا در ذخیره اطلاعات کاربر.');
    }
  };

  const toggleUserStatus = async (userToToggle) => {
    try {
      const updated = {
        ...userToToggle,
        is_active: !userToToggle.is_active,
        session_version: userToToggle.is_active ? (userToToggle.session_version || 1) + 1 : userToToggle.session_version
      };

      if (db.app_users) await db.app_users.put(updated);
      if (navigator.onLine) {
        await supabase.from('app_users').update({ 
          is_active: updated.is_active, 
          session_version: updated.session_version 
        }).eq('id', updated.id);
      }
      loadData();
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  if (!isOpen) return null;

  const roleColors = {
    admin: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    supervisor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    accountant: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    procurement: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    custom: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-500/30'
  };

  const roleNames = {
    admin: 'مدیر ارشد',
    supervisor: 'سرپرست',
    accountant: 'حسابدار',
    procurement: 'تدارکات',
    custom: 'سفارشی'
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 dark:bg-slate-900" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 dark:text-white text-sm">مدیریت کاربران و دسترسی‌ها</h1>
            {workspace && (
              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                کد کارگاه: <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{workspace.workspace_code}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                پکیج: <span className="uppercase text-indigo-500 font-semibold">{workspace.plan_tier}</span>
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
          <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full">
        {/* Status Card */}
        {workspace && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className="text-indigo-500 transition-all duration-1000" strokeDasharray={`${(usersList.filter(u => u.is_active).length / workspace.max_users_limit) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  <span>{usersList.filter(u => u.is_active).length}</span>
                  <span className="border-t border-slate-300 dark:border-slate-600 w-4 my-px"></span>
                  <span>{workspace.max_users_limit}</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">وضعیت مصرف پکیج</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {usersList.filter(u => u.is_active).length} کاربر فعال از {workspace.max_users_limit} کاربر مجاز مصرف شده است.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setSelectedUser(null);
                setIsFormOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> تعریف کاربر جدید
            </button>
          </div>
        )}

        {/* Users List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usersList.map(user => (
            <div key={user.id} className={`bg-white dark:bg-slate-800 rounded-2xl border ${!user.is_active ? 'border-rose-200 dark:border-rose-900/30 opacity-75' : 'border-slate-200 dark:border-slate-700'} p-4 shadow-sm relative overflow-hidden`}>
              {!user.is_active && (
                <div className="absolute top-0 right-0 left-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold py-0.5 text-center">
                  مسدود موقت (نشست ابطال شده)
                </div>
              )}
              
              <div className={`flex items-start justify-between gap-3 ${!user.is_active ? 'mt-4' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{user.full_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate" dir="ltr">@{user.username}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex-shrink-0 ${roleColors[user.role] || roleColors.custom}`}>
                  {roleNames[user.role] || user.role}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                {/* Actions */}
                <div className="flex gap-1.5">
                  <button onClick={() => { setSelectedUser(user); setIsFormOpen(true); }} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors" title="ویرایش">
                    <Edit className="w-4 h-4" />
                  </button>
                  {/* Cannot toggle oneself usually, but for UI let's allow or conditionally disable */}
                  <button 
                    onClick={() => toggleUserStatus(user)} 
                    disabled={user.id === currentUser?.id}
                    className={`p-1.5 rounded-lg transition-colors ${user.is_active ? 'bg-rose-50 hover:bg-rose-100 text-rose-500 dark:bg-rose-500/10 dark:hover:bg-rose-500/20' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-500 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20'} ${user.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title={user.is_active ? 'مسدودسازی موقت' : 'فعال‌سازی مجدد'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  {user.can_edit_past_records && <ShieldAlert className="w-3 h-3 text-amber-500" title="ویرایش گذشته" />}
                  {user.has_all_projects_access && <Key className="w-3 h-3 text-emerald-500" title="دسترسی همه پروژه‌ها" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <UserFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSave={handleSaveUser}
        initialData={selectedUser}
        workspaceId={workspace?.id}
      />
    </div>
  );
}
