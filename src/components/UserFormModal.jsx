import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { usePermissions } from '../context/AuthContext';
import { X, Save, Eye, EyeOff, Shield } from 'lucide-react';

export default function UserFormModal({ isOpen, onClose, onSave, initialData = null, workspaceId }) {
  const { language } = useLanguage();
  const { hasPermission } = usePermissions();

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'custom',
    can_edit_past_records: false,
    has_all_projects_access: false,
    permissions: []
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        full_name: initialData.full_name || '',
        username: initialData.username || '',
        password: '',
        role: initialData.role || 'custom',
        can_edit_past_records: initialData.can_edit_past_records || false,
        has_all_projects_access: initialData.has_all_projects_access || false,
        permissions: initialData.permissions || []
      });
    } else {
      setFormData({
        full_name: '',
        username: '',
        password: '',
        role: 'custom',
        can_edit_past_records: false,
        has_all_projects_access: false,
        permissions: []
      });
    }
  }, [initialData, isOpen]);

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    let newPermissions = [];
    
    if (newRole === 'admin') {
      newPermissions = []; // Admin has all implicitly
    } else if (newRole === 'supervisor') {
      newPermissions = ['attendance.write', 'attendance.read', 'expenses.manage'];
    } else if (newRole === 'accountant') {
      newPermissions = ['settlement.manage', 'reports.view', 'attendance.read'];
    } else if (newRole === 'procurement') {
      newPermissions = ['expenses.manage'];
    }

    setFormData({
      ...formData,
      role: newRole,
      permissions: newRole === 'custom' ? formData.permissions : newPermissions
    });
  };

  const handlePermissionToggle = (perm) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm) 
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold">{initialData ? 'ویرایش کاربر' : 'تعریف کاربر جدید'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نام و نام خانوادگی</label>
              <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نام کاربری</label>
              <input required type="text" disabled={!!initialData} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">کلمه عبور {initialData && '(فقط در صورت تغییر)'}</label>
              <div className="relative">
                <input required={!initialData} type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white" dir="ltr" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-3 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">نقش سازمانی</label>
            <select value={formData.role} onChange={handleRoleChange} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white mb-3">
              <option value="admin">مدیر (Admin)</option>
              <option value="supervisor">سرپرست کارگاه (Supervisor)</option>
              <option value="accountant">حسابدار / مدیر مالی (Accountant)</option>
              <option value="procurement">مسئول خرید / تدارکات (Procurement)</option>
              <option value="custom">سفارشی (Custom)</option>
            </select>

            {formData.role === 'custom' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2 mb-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">ماتریس دسترسی‌ها:</p>
                {[
                  { id: 'attendance.write', label: 'ثبت کارکرد روزانه' },
                  { id: 'attendance.read', label: 'فقط مشاهده حضور و غیاب' },
                  { id: 'settlement.manage', label: 'ثبت و مدیریت تسویه حساب' },
                  { id: 'expenses.manage', label: 'ثبت و ویرایش هزینه‌ها' },
                  { id: 'reports.view', label: 'مشاهده گزارش‌های مالی' },
                  { id: 'users.manage', label: 'مدیریت کاربران' }
                ].map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.permissions.includes(perm.id)} onChange={() => handlePermissionToggle(perm.id)} className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300" />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{perm.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.can_edit_past_records} onChange={e => setFormData({...formData, can_edit_past_records: e.target.checked})} className="rounded text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">اجازه ثبت یا ویرایش کارکرد برای روزهای گذشته</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.has_all_projects_access} onChange={e => setFormData({...formData, has_all_projects_access: e.target.checked})} className="rounded text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">دسترسی به تمام پروژه‌ها</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">انصراف</button>
          <button type="submit" onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-colors flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" /> ذخیره اطلاعات
          </button>
        </div>
      </div>
    </div>
  );
}
