import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { usePermissions, ROLE_DEFAULT_PERMISSIONS, hydrateUserFromRecord } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { X, Save, Eye, EyeOff, Shield, FolderKanban, CheckSquare } from 'lucide-react';

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
    organizationalRole: 'نقش سازمانی (انتخاب سریع دسترسی‌ها)',
    roles: {
      admin: 'مدیر ارشد (Admin - دسترسی کامل)',
      supervisor: 'سرپرست کارگاه (Supervisor)',
      accountant: 'حسابدار / مدیر مالی (Accountant)',
      procurement: 'مسئول هزینه‌ها / تدارکات (Procurement)',
      custom: 'سفارشی (Custom)'
    },
    permissionsMatrix: 'دسترسی‌های مجاز کاربر (قابل شخصی‌سازی):',
    selectAllPerms: 'انتخاب همه',
    clearAllPerms: 'حذف همه',
    permissions: {
      'dashboard.view': 'مشاهده پیشخوان (داشبورد)',
      'attendance.write': 'ثبت و ویرایش کارکرد روزانه',
      'attendance.read': 'مشاهده گزارش کارکرد و حضور و غیاب',
      'workers.manage': 'مدیریت پرسنل (افزودن/ویرایش کارگر و گروه‌ها)',
      'expenses.manage': 'ثبت و مدیریت هزینه‌ها و تنخواه',
      'settlement.manage': 'ثبت و مدیریت تسویه حساب و مساعده',
      'accounting.manage': 'مدیریت حسابداری، صندوق‌ها و طرف‌حساب‌ها',
      'reports.view': 'مشاهده گزارش‌ها و آمارهای مالی',
      'tasks.manage': 'مشاهده و مدیریت تسک‌های روزانه',
      'users.manage': 'مدیریت کاربران، پروژه‌ها و تنظیمات کلان'
    },
    canEditPastRecords: 'اجازه ثبت یا ویرایش کارکرد برای روزهای گذشته',
    hasAllProjectsAccess: 'دسترسی به تمام پروژه‌ها',
    allowedProjectsTitle: 'پروژه‌های مجاز برای این کاربر:',
    noProjectSelectedHint: 'حداقل یک پروژه را برای دسترسی کاربر انتخاب کنید.',
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
    organizationalRole: 'ڕۆڵی ڕێکخراوەیی (هەڵبژاردنی خێرای دەسەڵاتەکان)',
    roles: {
      admin: 'بەڕێوەبەری باڵا (Admin - دەسەڵاتی تەواو)',
      supervisor: 'سەرپەرشتیاری کارگە (Supervisor)',
      accountant: 'حیسابدار / بەڕێوەبەری دارایی (Accountant)',
      procurement: 'بەرپرسی خەرجییەکان / پێداویستی (Procurement)',
      custom: 'تایبەت (Custom)'
    },
    permissionsMatrix: 'دەسەڵاتە ڕێگەپێدراوەکانی بەکارهێنەر:',
    selectAllPerms: 'هەڵبژاردنی هەمووی',
    clearAllPerms: 'سڕینەوەی هەمووی',
    permissions: {
      'dashboard.view': 'بینینی داشبۆرد',
      'attendance.write': 'تۆمار و دەستکاریکردنی کارکردنی ڕۆژانە',
      'attendance.read': 'بینینی ڕاپۆرتی کارکردن و ئامادەبوون',
      'workers.manage': 'بەڕێوەبردنی کارمەندان (زیادکردن/دەستکاریکردن)',
      'expenses.manage': 'تۆمار و بەڕێوەبردنی خەرجییەکان',
      'settlement.manage': 'تۆمار و بەڕێوەبردنی یەکلاکردنەوەی حیساب و موساعەدە',
      'accounting.manage': 'بەڕێوەبردنی حیسابداری، سندوقەکان و لایەنەکان',
      'reports.view': 'بینینی ڕاپۆرت و ئامارە داراییەکان',
      'tasks.manage': 'بینین و بەڕێوەبردنی ئەرکەکانی ڕۆژانە',
      'users.manage': 'بەڕێوەبردنی بەکارهێنەران، پڕۆژەکان و ڕێکخستنەکان'
    },
    canEditPastRecords: 'ڕێگەپێدان بۆ تۆمار یان دەستکاریکردنی کارکردنی ڕۆژانی ڕابردوو',
    hasAllProjectsAccess: 'دەسەڵاتی دەستگەیشتن بە تەواوی پڕۆژەکان',
    allowedProjectsTitle: 'پڕۆژە ڕێگەپێدراوەکان بۆ ئەم بەکارهێنەرە:',
    noProjectSelectedHint: 'تکایە لانیکەم پڕۆژەیەک هەڵبژێرە.',
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
    organizationalRole: 'Organizational Role (Quick Preset)',
    roles: {
      admin: 'Admin (Full Access)',
      supervisor: 'Workshop Supervisor',
      accountant: 'Accountant / Financial Officer',
      procurement: 'Expenses & Procurement Officer',
      custom: 'Custom'
    },
    permissionsMatrix: 'User Permissions (Customizable):',
    selectAllPerms: 'Select All',
    clearAllPerms: 'Clear All',
    permissions: {
      'dashboard.view': 'View Workshop Dashboard',
      'attendance.write': 'Log & Edit Daily Attendance',
      'attendance.read': 'View Attendance & Work Reports',
      'workers.manage': 'Manage Personnel (Add/Edit Workers & Groups)',
      'expenses.manage': 'Log & Manage Expenses',
      'settlement.manage': 'Manage Settlements & Advances',
      'accounting.manage': 'Manage Accounting, Accounts & Counterparties',
      'reports.view': 'View Financial Reports & Analytics',
      'tasks.manage': 'View & Manage Daily Tasks',
      'users.manage': 'Manage Users, Projects & System Settings'
    },
    canEditPastRecords: 'Allow logging or editing attendance for past dates',
    hasAllProjectsAccess: 'Access to all projects',
    allowedProjectsTitle: 'Allowed Projects for this User:',
    noProjectSelectedHint: 'Please select at least one project for this user.',
    cancel: 'Cancel',
    save: 'Save User Information'
  }
};

export default function UserFormModal({ isOpen, onClose, onSave, initialData = null, workspaceId }) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = USER_FORM_COPY[langKey] || USER_FORM_COPY.fa;

  const { hasPermission } = usePermissions();
  const { activeProjects, currentProject } = useProject();

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'custom',
    can_edit_past_records: false,
    has_all_projects_access: false,
    allowed_project_ids: [],
    permissions: []
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const defaultProjId = currentProject?.id || activeProjects?.[0]?.id;
    if (initialData) {
      const hydrated = hydrateUserFromRecord(initialData);
      const initialAllowed =
        Array.isArray(hydrated.allowed_project_ids) && hydrated.allowed_project_ids.length > 0
          ? hydrated.allowed_project_ids
          : defaultProjId
            ? [defaultProjId]
            : [];
      setFormData({
        full_name: hydrated.full_name || '',
        username: hydrated.username || '',
        password: '',
        role: hydrated.role || 'custom',
        can_edit_past_records: Boolean(hydrated.can_edit_past_records),
        has_all_projects_access: Boolean(hydrated.has_all_projects_access),
        allowed_project_ids: initialAllowed,
        permissions: Array.isArray(hydrated.permissions) ? hydrated.permissions : []
      });
    } else {
      setFormData({
        full_name: '',
        username: '',
        password: '',
        role: 'accountant',
        can_edit_past_records: false,
        has_all_projects_access: false,
        allowed_project_ids: defaultProjId ? [defaultProjId] : [],
        permissions: [...(ROLE_DEFAULT_PERMISSIONS.accountant || [])]
      });
    }
  }, [initialData, isOpen]);

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    const presetPerms = ROLE_DEFAULT_PERMISSIONS[newRole] || [];

    setFormData((prev) => ({
      ...prev,
      role: newRole,
      has_all_projects_access: newRole === 'admin' ? true : prev.has_all_projects_access,
      can_edit_past_records: newRole === 'admin' ? true : prev.can_edit_past_records,
      permissions: newRole === 'custom' ? prev.permissions : [...presetPerms]
    }));
  };

  const handlePermissionToggle = (perm) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      let nextPerms = exists
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm];

      // If attendance.write is checked, automatically ensure attendance.read is also checked
      if (!exists && perm === 'attendance.write' && !nextPerms.includes('attendance.read')) {
        nextPerms.push('attendance.read');
      }

      // If user unchecks a permission while role === 'admin', switch role to 'custom' so RBAC doesn't grant full admin override
      const nextRole = prev.role === 'admin' && exists ? 'custom' : prev.role;

      return {
        ...prev,
        role: nextRole,
        permissions: nextPerms
      };
    });
  };

  const handleProjectToggle = (projectId) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.allowed_project_ids) ? prev.allowed_project_ids : [];
      const exists = current.includes(projectId);
      const nextProjects = exists
        ? current.filter((id) => id !== projectId)
        : [...current, projectId];
      return {
        ...prev,
        allowed_project_ids: nextProjects
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.has_all_projects_access && (!formData.allowed_project_ids || formData.allowed_project_ids.length === 0)) {
      const fallbackProjId = currentProject?.id || activeProjects?.[0]?.id;
      if (fallbackProjId) {
        onSave({ ...formData, allowed_project_ids: [fallbackProjId] });
        return;
      }
    }
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
    { id: 'dashboard.view', label: c.permissions['dashboard.view'] },
    { id: 'attendance.write', label: c.permissions['attendance.write'] },
    { id: 'attendance.read', label: c.permissions['attendance.read'] },
    { id: 'workers.manage', label: c.permissions['workers.manage'] },
    { id: 'expenses.manage', label: c.permissions['expenses.manage'] },
    { id: 'settlement.manage', label: c.permissions['settlement.manage'] },
    { id: 'accounting.manage', label: c.permissions['accounting.manage'] },
    { id: 'reports.view', label: c.permissions['reports.view'] },
    { id: 'tasks.manage', label: c.permissions['tasks.manage'] },
    { id: 'users.manage', label: c.permissions['users.manage'] }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir={direction}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
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

            {/* Always visible permissions checklist so role presets are transparent and customizable */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5 mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{c.permissionsMatrix}</span>
                </p>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, permissions: permissionsList.map(p => p.id) }))}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    {c.selectAllPerms}
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: prev.role === 'admin' ? 'custom' : prev.role, permissions: [] }))}
                    className="text-slate-500 dark:text-slate-400 hover:underline font-medium"
                  >
                    {c.clearAllPerms}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {permissionsList.map(perm => {
                  const isChecked = formData.role === 'admin' || formData.permissions.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handlePermissionToggle(perm.id)} 
                        className="rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 w-4 h-4" 
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{perm.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.role === 'admin' || formData.can_edit_past_records}
                disabled={formData.role === 'admin'}
                onChange={e => setFormData({...formData, can_edit_past_records: e.target.checked})}
                className="rounded text-indigo-600 w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {c.canEditPastRecords}
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.role === 'admin' || formData.has_all_projects_access}
                disabled={formData.role === 'admin'}
                onChange={e => setFormData({...formData, has_all_projects_access: e.target.checked})}
                className="rounded text-indigo-600 w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {c.hasAllProjectsAccess}
              </span>
            </label>

            {/* Per-Project Access Checklist when has_all_projects_access is unchecked */}
            {formData.role !== 'admin' && !formData.has_all_projects_access && activeProjects && activeProjects.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-800/50 space-y-2 animate-in fade-in duration-150">
                <p className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{c.allowedProjectsTitle}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {activeProjects.map((proj) => {
                    const isProjChecked = (formData.allowed_project_ids || []).includes(proj.id);
                    return (
                      <label
                        key={proj.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isProjChecked
                            ? 'bg-white dark:bg-slate-800 border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-200 font-bold shadow-2xs'
                            : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isProjChecked}
                          onChange={() => handleProjectToggle(proj.id)}
                          className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{proj.name}</span>
                      </label>
                    );
                  })}
                </div>
                {(!formData.allowed_project_ids || formData.allowed_project_ids.length === 0) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {c.noProjectSelectedHint}
                  </p>
                )}
              </div>
            )}
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
