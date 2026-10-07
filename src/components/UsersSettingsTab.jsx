import React, { useState, useEffect } from 'react';
import { Users, Shield, Plus, X, Search, ShieldCheck, Edit, Trash2, ShieldBan, UserCog, Activity, UserPlus, Power, ShieldAlert, Key } from 'lucide-react';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/realtimeSync';
import { logAuditAction, getSafeAuthContext, generateUUID } from '../services/auditLogger';
import { useLanguage } from '../i18n/LanguageContext';
import UserFormModal from './UserFormModal';
import AuditLogsTab from "./AuditLogsTab";

export default function UsersSettingsTab() {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'audit'
  const [usersList, setUsersList] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (currentUser?.workspace_id) {
      loadData();
    } else {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      const safeAuth = await getSafeAuthContext();
      let targetWorkspaceId = safeAuth.workspaceId;
      let targetWorkspace = null;

      // 🔥 CRITICAL FIX: Fetch true workspace_id directly from Supabase to override any local ghosts!
      if (navigator.onLine && supabase) {
        try {
          const { data: remoteUser } = await supabase.from('app_users').select('workspace_id').eq('id', safeAuth.userId).single();
          if (remoteUser && remoteUser.workspace_id) {
            targetWorkspaceId = remoteUser.workspace_id;
            console.log('☁️ Synced true workspace_id from Supabase:', targetWorkspaceId);
            
            // Update local app_users to reflect reality
            if (db.app_users) {
              await db.app_users.where('id').equals(safeAuth.userId).modify({ workspace_id: targetWorkspaceId }).catch(()=>{});
            }
          }
        } catch(e) {
          console.warn('Could not sync workspace_id from Supabase, using local.', e);
        }
      }

      if (targetWorkspaceId) {
        // Clean up ghost workspaces! Keep ONLY the target workspace
        if (db.workspaces) {
           const allWs = await db.workspaces.toArray();
           for (const ws of allWs) {
             if (ws.id !== targetWorkspaceId) {
                console.log('👻 Cleaning up ghost workspace:', ws.id);
                await db.workspaces.delete(ws.id);
             }
           }
        }
        
        targetWorkspace = await db.workspaces?.get(targetWorkspaceId);
        
        // Ensure the correct workspace exists locally
        if (!targetWorkspace) {
          targetWorkspace = {
             id: targetWorkspaceId,
             name: 'کارگاه مرکزی',
             workspace_code: 'KAR101',
             owner_id: safeAuth.userId,
             max_users_limit: 10,
             plan_tier: 'free',
             created_at: new Date().toISOString()
          };
          if (db.workspaces) await db.workspaces.put(targetWorkspace).catch(()=>{});
        }
      } else {
        console.warn('No targetWorkspaceId found!');
        return;
      }
      
      setWorkspace(targetWorkspace);

      // Now fetch users
      // Now fetch users
      if (db.app_users) {
        // 1. First fetch local so UI responds instantly
        let localUsers = await db.app_users.where('workspace_id').equals(targetWorkspaceId).toArray();
        setUsersList(localUsers);

        // 2. Fetch remote to sync missing users (like ones added via MCP)
        if (navigator.onLine && supabase) {
           try {
             const { data: remoteUsers, error } = await supabase
               .from('app_users')
               .select('*')
               .eq('workspace_id', targetWorkspaceId);
               
             if (!error && remoteUsers && remoteUsers.length > 0) {
                await db.app_users.bulkPut(remoteUsers);
                
                // Re-fetch local to ensure we have merged list
                localUsers = await db.app_users.where('workspace_id').equals(targetWorkspaceId).toArray();
                setUsersList(localUsers);
             } else if (!error && remoteUsers && remoteUsers.length === 0 && localUsers.length > 0) {
                console.warn("Supabase returned empty app_users for this workspace, but local has data. RLS might be blocking!");
             }
           } catch(e) {
             console.warn('Could not fetch app_users from Supabase:', e);
           }
        }
      }
    } catch (err) {
      console.error('Error in UsersSettingsTab loadData:', err);
    }
  };





  const handleSaveUser = async (formData) => {
    try {
      const safeAuth = await getSafeAuthContext();
      if (!safeAuth.workspaceId) throw new Error('ورک‌اسپیس معتبری یافت نشد!');

      if (!selectedUser && workspace && usersList.filter(u => u.is_active).length >= workspace.max_users_limit) {
        alert('سقف کاربران پکیج شما تکمیل شده است. برای افزودن کاربر جدید، پکیج خود را ارتقا دهید یا کاربری را غیرفعال کنید.');
        return;
      }

      if (!workspace) {
        alert('اطلاعات کارگاه هنوز بارگذاری نشده است. لطفاً صفحه را رفرش کنید.');
        return;
      }

      const userData = {
        ...formData,
        id: selectedUser ? selectedUser.id : generateUUID(),
        workspace_id: safeAuth.workspaceId,
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
        if (selectedUser) {
           const { error } = await supabase.from('app_users').update(userData).eq('id', selectedUser.id);
           if (error) console.error("Failed to update user remotely:", error);
        } else {
           const { error } = await supabase.from('app_users').insert(userData);
           if (error) console.error("Failed to insert user remotely:", error);
        }
      }

      await logAuditAction({
        workspaceId: safeAuth.workspaceId,
        userId: safeAuth.userId,
        userName: safeAuth.userName,
        actionType: selectedUser ? 'UPDATE_USER' : 'CREATE_USER',
        entityType: 'user',
        entityId: userData.id,
        details: {
          description: selectedUser ? `ویرایش کاربر ${userData.full_name}` : `تعریف کاربر جدید: ${userData.full_name}`,
          role: userData.role
        }
      });

      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('خطا در ذخیره اطلاعات کاربر:\n' + err.message);
    }
  };

  const deleteUser = async (userToDelete) => {
    if (userToDelete.id === currentUser?.id) {
      alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید!');
      return;
    }
    
    const confirmDelete = window.confirm(
      `⚠️ هشدار بسیار مهم!\n\nشما در حال حذف کامل کاربر «${userToDelete.full_name}» هستید.\n\nاگر این کاربر قبلاً فاکتور، هزینه، یا حضور و غیابی ثبت کرده باشد، حذف او باعث خراب شدن اطلاعات و گزارش‌های مالی شما خواهد شد!\n\nشدیداً توصیه می‌شود به جای حذف، از دکمه «غیرفعال‌سازی» (آیکن خاموش/روشن) استفاده کنید.\n\nآیا واقعاً از حذف کامل این کاربر مطمئن هستید؟`
    );
    
    if (!confirmDelete) return;

    try {
      const safeAuth = await getSafeAuthContext();

      if (db.app_users) await db.app_users.delete(userToDelete.id);
      if (navigator.onLine) {
        await supabase.from('app_users').delete().eq('id', userToDelete.id);
      }

      await logAuditAction({
        workspaceId: safeAuth.workspaceId,
        userId: safeAuth.userId,
        userName: safeAuth.userName,
        actionType: 'DELETE_USER',
        entityType: 'user',
        entityId: userToDelete.id,
        details: {
          description: `حذف کامل کاربر ${userToDelete.full_name}`
        }
      });

      loadData();
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('خطا در حذف کاربر: ' + err.message);
    }
  };
  const toggleUserStatus = async (userToToggle) => {
    try {
      const safeAuth = await getSafeAuthContext();

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

      await logAuditAction({
        workspaceId: safeAuth.workspaceId,
        userId: safeAuth.userId,
        userName: safeAuth.userName,
        actionType: updated.is_active ? 'UNBLOCK_USER' : 'BLOCK_USER',
        entityType: 'user',
        entityId: updated.id,
        details: {
          description: updated.is_active ? `فعال‌سازی کاربر ${updated.full_name}` : `مسدودسازی کاربر ${updated.full_name}`
        }
      });

      loadData();
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };


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
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Unified Tab Switcher (Right aligned, Navbar Style) */}
      <div className="flex justify-start mb-4">
        <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
          <button
            onClick={() => setActiveTab('users')}
            className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${activeTab === 'users' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 font-bold border border-blue-400/30' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'}`}
          >
            <Users className="w-5 h-5 transition-transform hover:scale-110" />
            {activeTab === 'users' && (
              <span className="text-xs font-semibold px-1 whitespace-nowrap animate-in fade-in">
                کاربران سیستم
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${activeTab === 'audit' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 font-bold border border-blue-400/30' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'}`}
          >
            <Activity className="w-5 h-5 transition-transform hover:scale-110" />
            {activeTab === 'audit' && (
              <span className="text-xs font-semibold px-1 whitespace-nowrap animate-in fade-in">
                تاریخچه فعالیت‌ها
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[400px]">
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full">
        {activeTab === 'audit' ? (
          <AuditLogsTab workspaceId={workspace?.id} />
        ) : (
          <>
            {/* Status Card */}
            {workspace && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className="text-blue-500 transition-all duration-1000" strokeDasharray={`${(usersList.filter(u => u.is_active).length / workspace.max_users_limit) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
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
                  className="w-full sm:w-auto px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> تعریف کاربر جدید
                </button>
              </div>
            )}

            {/* Users List */}
            {usersList.length <= 1 && (
              <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center mt-4">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">هنوز کاربر دیگری تعریف نشده است</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">برای افزودن پرسنل جدید به کارگاه، از دکمه زیر استفاده کنید.</p>
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setIsFormOpen(true);
                  }}
                  className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm text-xs font-semibold inline-flex items-center gap-2 transition-all"
                >
                  <UserPlus className="w-4 h-4" /> تعریف کاربر جدید
                </button>
              </div>
            )}
            
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${usersList.length <= 1 ? 'mt-4' : ''}`}>
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
                      <button 
                        onClick={() => toggleUserStatus(user)} 
                        disabled={user.id === currentUser?.id}
                        className={`p-1.5 rounded-lg transition-colors ${user.is_active ? 'bg-rose-50 hover:bg-rose-100 text-rose-500 dark:bg-rose-500/10 dark:hover:bg-rose-500/20' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-500 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20'} ${user.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={user.is_active ? 'مسدودسازی موقت' : 'فعال‌سازی مجدد'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteUser(user)} 
                        disabled={user.id === currentUser?.id}
                        className={`p-1.5 rounded-lg transition-colors bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-500/10 dark:hover:bg-red-500/20 ${user.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title="حذف کامل کاربر"
                      >
                        <Trash2 className="w-4 h-4" />
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
          </>
        )}
      </div>

      <UserFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSave={handleSaveUser}
        initialData={selectedUser}
        workspaceId={workspace?.id}
      />
    </div>
    </div>
  );
}
