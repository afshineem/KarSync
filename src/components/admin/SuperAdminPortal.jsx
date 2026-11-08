import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Crown, 
  Sparkles, 
  Search, 
  Filter, 
  RefreshCw, 
  LogOut, 
  ArrowLeft, 
  ArrowRight, 
  Lock, 
  KeyRound, 
  AlertTriangle,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Mail,
  User,
  Hash,
  Activity,
  Layers,
  X
} from 'lucide-react';
import { 
  fetchAllWorkspacesWithAccounts, 
  setWorkspaceActiveStatus, 
  setWorkspacePlanTier, 
  setUserActiveStatus,
  getSuperAdminSession,
  loginSuperAdmin,
  logoutSuperAdmin,
  navigateToMainApp,
  SUPER_ADMIN_EMAIL
} from '../../services/superAdminService';
import { useLanguage } from '../../i18n/LanguageContext';

export function SuperAdminPortal() {
  const { language, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  // Super Admin Auth State
  const [session, setSession] = useState(() => getSuperAdminSession());
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Data States
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [planFilter, setPlanFilter] = useState('all'); // all, basic, premium

  // Action / Modal States
  const [inspectWorkspace, setInspectWorkspace] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Translations
  const t = {
    fa: {
      portalTitle: 'مرکز مدیریت کل و لایسنس کارسینک',
      portalSub: 'سامانه نظارت بر کارگاه‌ها، کاربران و سطوح اشتراک (Super-Admin Control Plane)',
      kpiTotal: 'کل کارگاه‌ها',
      kpiActive: 'کارگاه‌های فعال',
      kpiSuspended: 'معلق / غیرفعال',
      kpiPremium: 'پلن‌های پریمیوم',
      kpiBasic: 'پلن‌های پایه',
      kpiUsers: 'کل کاربران عضو',
      searchPlaceholder: 'جستجو در نام کارگاه، کد کارگاه، نام مالک یا ایمیل...',
      filterAllStatus: 'همه وضعیت‌ها',
      filterActive: 'فقط فعال',
      filterInactive: 'فقط غیرفعال/معلق',
      filterAllPlans: 'همه پلن‌ها',
      filterPlanBasic: 'پلن پایه (Basic)',
      filterPlanPremium: 'پلن پریمیوم (PRO)',
      refresh: 'بروزرسانی داده‌ها',
      backToApp: 'بازگشت به کارسینک',
      logoutAdmin: 'خروج از پنل مدیریت',
      wsName: 'کارگاه / شرکت',
      wsOwner: 'مالک و ادمین',
      wsPlan: 'پلن اشتراک',
      wsStatus: 'وضعیت فعالیت',
      wsUsersCol: 'کاربران',
      wsActions: 'عملیات',
      activeStatus: 'فعال',
      inactiveStatus: 'غیرفعال (معلق)',
      planBasicLabel: 'پایه (Basic)',
      planPremiumLabel: 'پریمیوم (Premium)',
      btnUpgradeToPremium: 'ارتقا به پریمیوم',
      btnDowngradeToBasic: 'تنزیل به پایه',
      btnSuspend: 'غیرفعال‌سازی',
      btnActivate: 'فعال‌سازی مجدد',
      manageUsers: 'مدیریت کاربران',
      superAdminLoginTitle: 'ورود به پورتال سوپر ادمین کارسینک',
      superAdminLoginSub: 'این بخش مختص مدیریت کل سیستم است. لطفاً رمز عبور حساب ادمین کل را وارد کنید.',
      passwordPlaceholder: 'رمز عبور یا کلید دسترسی مستر...',
      loginBtn: 'تایید و ورود به پنل مدیریت',
      emptyResults: 'هیچ کارگاه یا حسابی با این مشخصات یافت نشد.',
      confirmSuspendPrompt: 'آیا از غیرفعال کردن این کارگاه اطمینان دارید؟ کاربران آن بلافاصله مسدود می‌شوند.',
      confirmActivatePrompt: 'آیا می‌خواهید دسترسی این کارگاه مجدداً فعال شود؟',
      confirmChangePlanPrompt: 'آیا از تغییر پلن این کارگاه اطمینان دارید؟',
      modalUsersTitle: 'کاربران کارگاه',
      close: 'بستن'
    },
    ku: {
      portalTitle: 'ناوەندی بەڕێوەبەرایەتی گشتیی KarSync',
      portalSub: 'سیستەمی چاودێری کارگەکان، بەکارهێنەران و ئاستی بەشداری (Super-Admin Control Plane)',
      kpiTotal: 'گشت کارگەکان',
      kpiActive: 'کارگە چالاکەکان',
      kpiSuspended: 'ڕاگیراو / ناچالاک',
      kpiPremium: 'پلانی پریمیۆم',
      kpiBasic: 'پلانی بنەڕەتی',
      kpiUsers: 'گشت بەکارهێنەران',
      searchPlaceholder: 'گەڕان لە ناوی کارگە، کۆد، خاوەنکار یان ئیمەیڵ...',
      filterAllStatus: 'هەموو دۆخەکان',
      filterActive: 'تەنیا چالاک',
      filterInactive: 'تەنیا ناچالاک',
      filterAllPlans: 'هەموو پلانەکان',
      filterPlanBasic: 'پلانی بنەڕەتی (Basic)',
      filterPlanPremium: 'پلانی پریمیۆم (PRO)',
      refresh: 'نوێکردنەوەی داتا',
      backToApp: 'گەڕانەوە بۆ KarSync',
      logoutAdmin: 'چوونەدەرەوە لە بەڕێوەبەرایەتی',
      wsName: 'کارگە / کۆمپانیا',
      wsOwner: 'خاوەنکار و بەڕێوەبەر',
      wsPlan: 'ئاستی بەشداری',
      wsStatus: 'دۆخی چالاکی',
      wsUsersCol: 'بەکارهێنەران',
      wsActions: 'کردارەکان',
      activeStatus: 'چالاک',
      inactiveStatus: 'ناچالاک',
      planBasicLabel: 'بنەڕەتی (Basic)',
      planPremiumLabel: 'پریمیۆم (Premium)',
      btnUpgradeToPremium: 'بەرزکردنەوە بۆ پریمیۆم',
      btnDowngradeToBasic: 'دابەزاندن بۆ بنەڕەتی',
      btnSuspend: 'ناچالاککردن',
      btnActivate: 'چالاککردنەوە',
      manageUsers: 'بەڕێوەبردنی کارمەندان',
      superAdminLoginTitle: 'چوونەژوورەوەی سوپەر ئەدمین',
      superAdminLoginSub: 'تایبەت بە بەڕێوەبەری گشتی. وشەی نهێنی یان کلیلی سوپەر ئەدمین داخڵ بکە.',
      passwordPlaceholder: 'وشەی نهێنی یان کلیلی ماستەر...',
      loginBtn: 'چوونەژوورەوە',
      emptyResults: 'هیچ کارگەیەک بەم زانیارییە نەدۆزرایەوە.',
      confirmSuspendPrompt: 'دڵنیایت لە ناچالاککردنی ئەم کارگەیە؟ دەستبەجێ بەستەڵەک دەکرێت.',
      confirmActivatePrompt: 'دڵنیایت لە چالاککردنەوەی ئەم کارگەیە؟',
      confirmChangePlanPrompt: 'دڵنیایت لە گۆڕینی پلانی ئەم کارگەیە؟',
      modalUsersTitle: 'بەکارهێنەرانی کارگە',
      close: 'داخستن'
    },
    en: {
      portalTitle: 'KarSync Super-Admin Control Plane',
      portalSub: 'Global tenant management, subscription tiers, and system-wide account control',
      kpiTotal: 'Total Workspaces',
      kpiActive: 'Active Tenants',
      kpiSuspended: 'Suspended',
      kpiPremium: 'Premium Tiers',
      kpiBasic: 'Basic Tiers',
      kpiUsers: 'Total Users',
      searchPlaceholder: 'Search by workspace name, code, owner, or email...',
      filterAllStatus: 'All Statuses',
      filterActive: 'Active Only',
      filterInactive: 'Suspended Only',
      filterAllPlans: 'All Plans',
      filterPlanBasic: 'Basic Plan',
      filterPlanPremium: 'Premium (PRO)',
      refresh: 'Refresh Data',
      backToApp: 'Back to App',
      logoutAdmin: 'Sign Out Admin',
      wsName: 'Workspace / Organization',
      wsOwner: 'Owner & Admin',
      wsPlan: 'Plan Tier',
      wsStatus: 'Status',
      wsUsersCol: 'Users',
      wsActions: 'Actions',
      activeStatus: 'Active',
      inactiveStatus: 'Suspended',
      planBasicLabel: 'Basic',
      planPremiumLabel: 'Premium',
      btnUpgradeToPremium: 'Upgrade to PRO',
      btnDowngradeToBasic: 'Downgrade to Basic',
      btnSuspend: 'Suspend',
      btnActivate: 'Activate',
      manageUsers: 'Inspect Users',
      superAdminLoginTitle: 'Super-Admin Authentication',
      superAdminLoginSub: 'Restricted system control center. Please authenticate with master credentials.',
      passwordPlaceholder: 'Master password or access key...',
      loginBtn: 'Authenticate & Enter',
      emptyResults: 'No workspaces match the specified criteria.',
      confirmSuspendPrompt: 'Are you sure you want to suspend this workspace? Its users will be locked out immediately.',
      confirmActivatePrompt: 'Are you sure you want to reactivate this workspace?',
      confirmChangePlanPrompt: 'Are you sure you want to change the subscription tier?',
      modalUsersTitle: 'Workspace Personnel & Users',
      close: 'Close'
    }
  };

  const loc = t[language] || t.fa;

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllWorkspacesWithAccounts();
      setWorkspaces(data);
    } catch (err) {
      console.error('Failed to load super admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await loginSuperAdmin(loginKey);
      if (res.success) {
        setSession(res.session);
      } else {
        setLoginError(language === 'fa' ? 'گذرواژه یا کلید مستر اشتباه است' : 'رمز عبور نامعتبر است');
      }
    } catch (err) {
      setLoginError(err.message || 'خطا در احراز هویت');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutSuperAdmin();
    setSession(null);
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = workspaces.length;
    const active = workspaces.filter(w => w.is_active !== false).length;
    const suspended = total - active;
    const premium = workspaces.filter(w => (w.plan_tier || 'basic') === 'premium').length;
    const basic = total - premium;
    const totalUsers = workspaces.reduce((sum, w) => sum + (w.usersCount || 0), 0);
    return { total, active, suspended, premium, basic, totalUsers };
  }, [workspaces]);

  // Filtered List
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter(w => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (w.name || '').toLowerCase().includes(q);
        const matchCode = (w.workspace_code || '').toLowerCase().includes(q);
        const matchOwner = (w.ownerName || '').toLowerCase().includes(q);
        const matchEmail = (w.ownerEmail || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchOwner && !matchEmail) return false;
      }
      // Status filter
      if (statusFilter === 'active' && w.is_active === false) return false;
      if (statusFilter === 'inactive' && w.is_active !== false) return false;

      // Plan filter
      const plan = w.plan_tier || 'basic';
      if (planFilter === 'basic' && plan !== 'basic') return false;
      if (planFilter === 'premium' && plan !== 'premium') return false;

      return true;
    });
  }, [workspaces, searchQuery, statusFilter, planFilter]);

  // Execute Toggle Active
  const handleToggleWorkspaceStatus = async (workspace) => {
    const nextStatus = !workspace.is_active;
    const confirmText = nextStatus ? loc.confirmActivatePrompt : loc.confirmSuspendPrompt;
    if (!window.confirm(confirmText)) return;

    try {
      const res = await setWorkspaceActiveStatus(workspace.id, nextStatus);
      if (res.success) {
        setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, is_active: nextStatus } : w));
        showToast(nextStatus ? 'کارگاه با موفقیت فعال شد' : 'کارگاه با موفقیت تعلیق شد');
      }
    } catch (e) {
      alert('خطا در تغییر وضعیت کارگاه');
    }
  };

  // Execute Toggle Plan
  const handleToggleWorkspacePlan = async (workspace) => {
    const currentPlan = workspace.plan_tier || 'basic';
    const nextPlan = currentPlan === 'premium' ? 'basic' : 'premium';
    if (!window.confirm(loc.confirmChangePlanPrompt)) return;

    try {
      const res = await setWorkspacePlanTier(workspace.id, nextPlan);
      if (res.success) {
        setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, plan_tier: nextPlan } : w));
        showToast(nextPlan === 'premium' ? 'پلن پریمیوم فعال شد' : 'پلن به بیسیک تنزیل یافت');
      }
    } catch (e) {
      alert('خطا در تغییر پلن اشتراک');
    }
  };

  // Toggle internal user active status
  const handleToggleUser = async (user, workspaceId) => {
    const next = !user.is_active;
    try {
      const res = await setUserActiveStatus(user.id, workspaceId, next);
      if (res.success) {
        setWorkspaces(prev => prev.map(w => {
          if (w.id === workspaceId) {
            const updatedUsers = (w.users || []).map(u => u.id === user.id ? { ...u, is_active: next } : u);
            return { ...w, users: updatedUsers };
          }
          return w;
        }));
        if (inspectWorkspace && inspectWorkspace.id === workspaceId) {
          setInspectWorkspace(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === user.id ? { ...u, is_active: next } : u)
          }));
        }
      }
    } catch (err) {
      alert('خطا در تغییر وضعیت کاربر');
    }
  };

  const showToast = (msg) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  // ==========================================
  // VIEW 1: SUPER ADMIN LOGIN (If unauthenticated)
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/15 dark:bg-primary/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-400/15 dark:bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-800 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative z-10 text-center">
          
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-slate-900 to-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
            <Lock className="w-8 h-8 text-amber-300" />
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            {loc.superAdminLoginTitle}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            {loc.superAdminLoginSub}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-start">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                ایمیل ادمین ارشد (تایید شده)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-mono">
                <Mail className="w-4 h-4 text-primary" />
                <span>{SUPER_ADMIN_EMAIL}</span>
              </div>
            </div>

            <div className="text-start">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                رمز عبور / کلید مستر
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginKey}
                  onChange={(e) => setLoginKey(e.target.value)}
                  placeholder={loc.passwordPlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            {loginError && (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>{loc.loginBtn}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={navigateToMainApp}
              className="text-xs font-bold text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{loc.backToApp}</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SUPER ADMIN DASHBOARD & MATRIX
  // ==========================================
  return (
    <div className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-white pb-20 select-none">
      
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-5 inset-x-0 mx-auto w-fit z-50 px-5 py-2.5 rounded-2xl bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 backdrop-blur-md shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/60 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-primary to-amber-500 text-white flex items-center justify-center shadow-md">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight">{loc.portalTitle}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ROOT
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">{loc.portalSub}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title={loc.refresh}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>

            <button
              type="button"
              onClick={navigateToMainApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{loc.backToApp}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={loc.logoutAdmin}
              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900 hover:bg-rose-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* KPI Banner Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiTotal}</span>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-black">{kpis.total}</div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiActive}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{kpis.active}</div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiSuspended}</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">{kpis.suspended}</div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiPremium}</span>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{kpis.premium}</div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiBasic}</span>
              <Layers className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-xl font-black text-sky-600 dark:text-sky-400">{kpis.basic}</div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
              <span className="text-[11px] font-bold">{loc.kpiUsers}</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{kpis.totalUsers}</div>
          </div>

        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-3">
          
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={loc.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{loc.filterAllStatus}</option>
              <option value="active">{loc.filterActive}</option>
              <option value="inactive">{loc.filterInactive}</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{loc.filterAllPlans}</option>
              <option value="basic">{loc.filterPlanBasic}</option>
              <option value="premium">{loc.filterPlanPremium}</option>
            </select>
          </div>

        </div>

        {/* Workspaces List / Cards */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500">در حال دریافت و تحلیل وضعیت کارگاه‌ها...</p>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="py-16 text-center bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500">{loc.emptyResults}</p>
            </div>
          ) : (
            filteredWorkspaces.map(ws => {
              const isActive = ws.is_active !== false;
              const isPremium = (ws.plan_tier || 'basic') === 'premium';

              return (
                <div
                  key={ws.id}
                  className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border rounded-2xl p-4 sm:p-5 shadow-sm transition-all ${
                    !isActive
                      ? 'border-rose-300/80 dark:border-rose-900/60 opacity-75 bg-rose-50/20 dark:bg-rose-950/10'
                      : 'border-white/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Col 1: Workspace Info */}
                    <div className="flex items-start gap-3.5 min-w-[280px]">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                        isPremium 
                          ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-amber-500/20' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {isPremium ? <Crown className="w-6 h-6 text-white" /> : <Building2 className="w-6 h-6 text-primary" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">{ws.name}</h3>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                            {ws.workspace_code || '---'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-primary" />
                            {ws.ownerName}
                          </span>
                          {ws.ownerEmail && (
                            <span className="flex items-center gap-1 font-mono">
                              <Mail className="w-3 h-3" />
                              {ws.ownerEmail}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ws.created_at || Date.now()).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Badges & Users Count */}
                    <div className="flex items-center gap-3">
                      {/* Users Count Pill */}
                      <button
                        type="button"
                        onClick={() => setInspectWorkspace(ws)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{ws.usersCount || 0} کاربر</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>

                      {/* Plan Tier Badge */}
                      <div className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                        isPremium
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                      }`}>
                        {isPremium ? <Sparkles className="w-3.5 h-3.5 text-amber-500" /> : <Layers className="w-3.5 h-3.5 text-sky-500" />}
                        <span>{isPremium ? loc.planPremiumLabel : loc.planBasicLabel}</span>
                      </div>

                      {/* Active Status Badge */}
                      <div className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      }`}>
                        {isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>{isActive ? loc.activeStatus : loc.inactiveStatus}</span>
                      </div>
                    </div>

                    {/* Col 3: Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      
                      {/* Toggle Plan Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleWorkspacePlan(ws)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                          isPremium
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/20 hover:scale-[1.02]'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>{isPremium ? loc.btnDowngradeToBasic : loc.btnUpgradeToPremium}</span>
                      </button>

                      {/* Toggle Active Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleWorkspaceStatus(ws)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/60'
                        }`}
                      >
                        {isActive ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        <span>{isActive ? loc.btnSuspend : loc.btnActivate}</span>
                      </button>

                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* Workspace Users Modal */}
      {inspectWorkspace && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/60 dark:border-slate-800 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black">{loc.modalUsersTitle}: {inspectWorkspace.name}</h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">کد کارگاه: {inspectWorkspace.workspace_code}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectWorkspace(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {(inspectWorkspace.users || []).length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">هیچ کاربری در این کارگاه ثبت نشده است.</p>
              ) : (
                (inspectWorkspace.users || []).map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>{u.full_name || u.username}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {u.role || 'کاربر'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        شناسه: {u.username || u.id}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleUser(u, inspectWorkspace.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        u.is_active !== false
                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                      }`}
                    >
                      {u.is_active !== false ? 'فعال' : 'غیرفعال'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectWorkspace(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {loc.close}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
