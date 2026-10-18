import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { usePermissions } from '../context/AuthContext';
import { X, Save, Eye, EyeOff, Shield } from 'lucide-react';

const USER_FORM_COPY = {
  fa: {
    editUser: 'ویرایش کاربر',
    newUser: 'تعریف کاربر جدید',
    fullName: 'نام و نام خانوادگی',
    fullNamePlaceholder: 'مثال: علی احمدی',
    username: 'نام کاربری',
    usernamePlaceholder: 'نام کاربری لاتین',
    password: 'کلمه عبور',
    passwordChangeOnly: ' (فقط در صورت تغییر)',
    passwordPlaceholder: 'حداقل ۶ کاراکتر',
    organizationalRole: 'نقش سازمانی',
    roles: {
      admin: 'مدیر (Admin)',
      supervisor: 'سرپرست کارگاه (Supervisor)',
      accountant: 'حسابدار / مدیر مالی (Accountant)',
      procurement: 'مسئول خرید / تدارکات (Procurement)',
      custom: 'سفارشی (Custom)'
    },
    permissionsMatrix: 'ماتریس دسترسی‌ها:',
    permissions: {
      'attendance.write': 'ثبت کارکرد روزانه',
      'attendance.read': 'فقط مشاهده حضور و غیاب',
      'settlement.manage': 'ثبت و مدیریت تسویه حساب',
      'expenses.manage': 'ثبت و ویرایش هزینه‌ها',
      'reports.view': 'مشاهده گزارش‌های مالی',
      'users.manage': 'مدیریت کاربران'
    },
    canEditPastRecords: 'اجازه ثبت یا ویرایش کارکرد برای روزهای گذشته',
    hasAllProjectsAccess: 'دسترسی به تمام پروژه‌ها',
    cancel: 'انصراف',
    save: 'ذخیره اطلاعات'
  },
  ku: {
    editUser: 'دەستکاریکردنی بەکارهێنەر',
    newUser: 'پێناسەکردنی بەکارهێنەری نوێ',
    fullName: 'ناو و پاشناو',
    fullNamePlaceholder: 'نموونە: ئارام ئەحمەد',
    username: 'ناوی بەکارهێنەر',
    usernamePlaceholder: 'ناوی بەکارهێنەری ئینگلیزی',
    password: 'وشەی تێپەڕ',
    passwordChangeOnly: ' (تەنها لە کاتی گۆڕین)',
    passwordPlaceholder: 'لانی کەم ٦ پیت',
    organizationalRole: 'ڕۆڵی ڕێکخراوەیی',
    roles: {
      admin: 'بەڕێوەبەر (Admin)',
      supervisor: 'سەرپەرشتیاری کارگە (Supervisor)',
      accountant: 'حیسابدار / بەڕێوەبەری دارایی (Accountant)',
      procurement: 'بەرپرسی کڕین / پێداویستییەکان (Procurement)',
      custom: 'تایبەت (Custom)'
    },
    permissionsMatrix: 'ماتریسی دەسەڵاتەکان:',
    permissions: {
      'attendance.write': 'تۆمارکردنی کارکردنی ڕۆژانە',
      'attendance.read': 'تەنها بینینی ئامادەبوون و غیاب',
      'settlement.manage': 'تۆمار و بەڕێوەبردنی یەکلاکردنەوەی حیساب',
      'expenses.manage': 'تۆمار و دەستکاریکردنی خەرجییەکان',
      'reports.view': 'بینینی ڕاپۆرتە داراییەکان',
      'users.manage': 'بەڕێوەبردنی بەکارهێنەران'
    },
    canEditPastRecords: 'ڕێگەپێدان بۆ تۆمار یان دەستکاریکردنی کارکردنی ڕۆژانی ڕابردوو',
    hasAllProjectsAccess: 'دەسەڵاتی دەستگەیشتن بە تەواوی پڕۆژەکان',
    cancel: 'پاشگەزبوونەوە',
    save: 'پاشەکەوتکردنی زانیارییەکان'
  },
  en: {
    editUser: 'Edit User',
    newUser: 'Define New User',
    fullName: 'Full Name',
    fullNamePlaceholder: 'e.g., John Doe',
    username: 'Username',
    usernamePlaceholder: 'Latin username',
    password: 'Password',
    passwordChangeOnly: ' (only if changing)',
    passwordPlaceholder: 'At least 6 characters',
    organizationalRole: 'Organizational Role',
    roles: {
      admin: 'Admin',
      supervisor: 'Workshop Supervisor',
      accountant: 'Accountant / Financial Officer',
      procurement: 'Procurement Officer',
      custom: 'Custom'
    },
    permissionsMatrix: 'Permissions Matrix:',
    permissions: {
      'attendance.write': 'Log Daily Attendance',
      'attendance.read': 'View Attendance Logs Only',
      'settlement.manage': 'Manage & Execute Settlements',
      'expenses.manage': 'Log & Edit Expenses',
      'reports.view': 'View Financial Reports',
      'users.manage': 'Manage Users'
    },
    canEditPastRecords: 'Allow logging or editing attendance for past dates',
    hasAllProjectsAccess: 'Access to all projects',
    cancel: 'Cancel',
    save: 'Save User Information'
  }
};

export default function UserFormModal({ isOpen, onClose, onSave, initialData = null, workspaceId }) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = USER_FORM_COPY[langKey] || USER_FORM_COPY.fa;

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const permissionsList = [
    { id: 'attendance.write', label: c.permissions['attendance.write'] },
    { id: 'attendance.read', label: c.permissions['attendance.read'] },
    { id: 'settlement.manage', label: c.permissions['settlement.manage'] },
    { id: 'expenses.manage', label: c.permissions['expenses.manage'] },
    { id: 'reports.view', label: c.permissions['reports.view'] },
    { id: 'users.manage', label: c.permissions['users.manage'] }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir={direction}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-sm sm:text-base">{initialData ? c.editUser : c.newUser}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {c.fullName}
              </label>
              <input 
                required 
                type="text" 
                placeholder={c.fullNamePlaceholder}
                value={formData.full_name} 
                onChange={e => setFormData({...formData, full_name: e.target.value})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {c.username}
              </label>
              <input 
                required 
                type="text" 
                disabled={!!initialData} 
                placeholder={c.usernamePlaceholder}
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white disabled:opacity-60" 
                dir="ltr" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {c.password}{initialData ? c.passwordChangeOnly : ''}
              </label>
              <div className="relative">
                <input 
                  required={!initialData} 
                  type={showPassword ? "text" : "password"} 
                  placeholder={c.passwordPlaceholder}
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  className="w-full p-2.5 pe-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                  dir="ltr" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-3 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {c.organizationalRole}
            </label>
            <select value={formData.role} onChange={handleRoleChange} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white mb-3">
              <option value="admin">{c.roles.admin}</option>
              <option value="supervisor">{c.roles.supervisor}</option>
              <option value="accountant">{c.roles.accountant}</option>
              <option value="procurement">{c.roles.procurement}</option>
              <option value="custom">{c.roles.custom}</option>
            </select>

            {formData.role === 'custom' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2 mb-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">{c.permissionsMatrix}</p>
                {permissionsList.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.permissions.includes(perm.id)} 
                      onChange={() => handlePermissionToggle(perm.id)} 
                      className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300" 
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{perm.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.can_edit_past_records} onChange={e => setFormData({...formData, can_edit_past_records: e.target.checked})} className="rounded text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {c.canEditPastRecords}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.has_all_projects_access} onChange={e => setFormData({...formData, has_all_projects_access: e.target.checked})} className="rounded text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {c.hasAllProjectsAccess}
              </span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
            {c.cancel}
          </button>
          <button type="submit" onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-colors flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" /> {c.save}
          </button>
        </div>
      </div>
    </div>
  );
}
