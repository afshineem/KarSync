import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import {
  Lock,
  User,
  Mail,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  UserPlus,
  Check,
  Sun,
  Moon,
  Smartphone,
  KeyRound,
  ShieldCheck,
  Clock,
  CalendarCheck,
  WalletCards,
  Sparkles,
  Languages,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Shield
} from 'lucide-react';

export function LoginView({ theme, toggleTheme }) {
  const { login, signUp, completeTwoFactorLogin, cancelTwoFactorLogin, resendEmailOtp, getLoginLockStatus, resetPassword } = useAuth();
  const { t, language, changeLanguage, direction, convertDigits, numberFormat } = useLanguage();

  const isRtl = direction === 'rtl';
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | '2fa'
  const [loginRole, setLoginRole] = useState('admin'); // 'admin' | 'staff'
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Sign In Form State
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA Challenge State
  const [totpCode, setTotpCode] = useState('');
  const [isUsingBackup, setIsUsingBackup] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Sign Up Form State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupCompanyName, setSignupCompanyName] = useState('');
  const [signupFullName, setSignupFullName] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate Limiting Lock Countdown
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Trilingual UI Dictionary for Login & Signup View (Zero Cross-Language Leakage)
  const copy = {
    fa: {
      versionBadge: 'نسخه ۰.۹.۰',
      brandSubtitle: 'سامانه هوشمند مدیریت کارگاه، حضور و غیاب و مهندسی مالی',
      heroBadge: 'نسل جدید مدیریت کارگاه و پروژه',
      heroTitle: 'مدیریت یکپارچه کارکرد، دستمزد و حسابداری کارگاه',
      heroDesc:
        'ثبت سریع شیفت‌های روزانه، محاسبه دقیق اضافه‌کاری و مساعده‌ها، صدور برگه‌های تسویه‌حساب و پرتال اختصاصی پرسنل با همگام‌سازی ابری و آفلاین.',
      feat1Title: 'ثبت کارکرد و شیفت هوشمند',
      feat1Desc: 'ثبت انفرادی و گروهی کارکرد روزانه با پشتیبانی کامل از حالت آفلاین و ابری',
      feat2Title: 'مهندسی مالی و میز تسویه',
      feat2Desc: 'مدیریت صندوق‌ها، تنخواه، مساعده و تسویه‌حساب شفاف با پرسنل و طرف‌حساب‌ها',
      feat3Title: 'امنیت چندلایه و پرتال پرسنل',
      feat3Desc: 'احراز هویت دو مرحله‌ای (2FA)، سطح‌بندی دسترسی‌ها و لینک اختصاصی کارگران',
      securityFooter: 'محافظت‌شده با رمزنگاری ابری و قفل امنیتی دو مرحله‌ای',
      signInTab: 'ورود به حساب',
      signUpTab: 'ثبت‌نام کارگاه جدید',
      signInHeaderTitle: 'ورود به پیشخوان کارگاه',
      signInHeaderSubtitle: 'مشخصات حساب کاربری خود را جهت ورود وارد نمایید',
      roleAdminTab: 'مدیران و کارفرمایان',
      roleStaffTab: 'پرسنل و همکاران کارگاه',
      adminEmailLabel: 'ایمیل کاری مدیر',
      adminEmailPlaceholder: 'manager@company.com',
      forgotPasswordLink: 'رمز عبور خود را فراموش کرده‌اید؟',
      forgotModalTitle: 'بازیابی حساب و رمز عبور',
      forgotModalSubtitle: 'ایمیل ثبت‌نامی خود را وارد کنید تا لینک تغییر رمز برای شما ارسال شود',
      sendResetLinkBtn: 'ارسال لینک بازیابی رمز',
      sendingResetLink: 'در حال ارسال...',
      resetLinkSentMsg: 'لینک بازیابی رمز عبور به ایمیل شما ارسال شد. لطفاً صندوق ورودی (و پوشه هرزنامه/Spam) خود را بررسی کنید.',
      closeBtn: 'بستن',
      errEmailRequired: 'لطفاً ایمیل کاری خود را وارد کنید.',
      errAdminSignInFields: 'لطفاً ایمیل کاری و رمز عبور را وارد کنید.',
      signUpHeaderTitle: 'ایجاد کارگاه و حساب مدیریت',
      signUpHeaderSubtitle: 'در کمتر از یک دقیقه کارگاه جدید خود را راه‌اندازی کنید',
      workspaceCodeLabel: 'کد کارگاه',
      workspaceCodeHint: 'کد اختصاصی کارگاه (مثال: KARS-101)',
      identifierLabel: 'ایمیل، نام کاربری یا کد پرسنلی',
      identifierPlaceholder: 'نام کاربری، ایمیل یا کد پرسنلی',
      passwordLabel: 'رمز عبور',
      showPasswordTitle: 'نمایش یا مخفی‌سازی رمز عبور',
      loginBtn: 'ورود به سیستم',
      loggingIn: 'در حال بررسی و ورود...',
      workEmailLabel: 'ایمیل کاری (حساب مدیر)',
      workEmailPlaceholder: 'manager@company.com',
      companyNameLabel: 'نام کارگاه یا پروژه',
      companyNamePlaceholder: 'مثال: کارگاه ساختمانی پارس',
      defaultCompanyName: 'کارگاه من',
      managerNameLabel: 'نام و نام خانوادگی مدیر',
      managerNamePlaceholder: 'مثال: افشین زارعی',
      createAccountBtn: 'ایجاد کارگاه و ورود به برنامه',
      creatingAccount: 'در حال ساخت کارگاه...',
      twoFaTitle: 'تایید هویت دو مرحله‌ای (2FA)',
      twoFaEmailTitle: 'تایید رمز موقت ایمیل',
      twoFaTotpDesc: 'کد ۶ رقمی نمایش داده شده در برنامه تایید هویت دو مرحله‌ای را وارد کنید:',
      twoFaBackupDesc: 'یکی از کدهای بازیابی اضطراری ۸ کاراکتری خود را وارد کنید:',
      twoFaEmailDesc: (email) => `رمز موقت ۶ رقمی به ایمیل ${email} ارسال شد. لطفاً آن را وارد نمایید:`,
      resendOtpIn: (time) => `ارسال مجدد کد پس از ${time}`,
      resendOtpBtn: 'ارسال مجدد کد تایید',
      msgOtpResent: 'کد تایید جدید به ایمیل شما ارسال شد.',
      totpPlaceholder: '۰۰۰۰۰۰',
      verifyAndSignIn: 'تایید کد و ورود به سیستم',
      useAuthenticatorApp: 'ورود با کد ۶ رقمی برنامه تایید هویت',
      useBackupCode: 'استفاده از کد بازیابی اضطراری',
      backToSignIn: 'بازگشت به صفحه ورود',
      lockoutBanner: (time) => `ورود به سیستم موقتاً قفل است. زمان باقی‌مانده: ${time}`,
      errAccountLocked: (time) => `حساب موقتاً قفل است. لطفاً ${time} دیگر صبر کنید.`,
      errMissingSignInFields: 'لطفاً کد کارگاه، نام کاربری و رمز عبور را به طور کامل وارد کنید.',
      errRateLimited: 'تعداد تلاش‌های ناموفق بیش از حد مجاز بود. ورود به مدت ۵ دقیقه قفل شد.',
      errInvalidCredentials: 'کد کارگاه، نام کاربری یا رمز عبور اشتباه است.',
      errInvalidWorkspaceCode: 'کد کارگاه وارد شده یافت نشد. لطفاً کد کارگاه را بررسی کنید.',
      errAccountBlocked: 'این حساب کاربری غیرفعال شده است. لطفاً با مدیر کارگاه تماس بگیرید.',
      errNetwork: 'خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.',
      errUserAlreadyExists: 'این ایمیل قبلاً ثبت شده است. لطفاً از بخش ورود به حساب استفاده کنید.',
      errEmailNotConfirmed: 'ایمیل شما هنوز تایید نشده است. لطفاً صندوق ورودی ایمیل خود را بررسی کنید.',
      errInvalidEmailFormat: 'ساختار ایمیل وارد شده معتبر نیست.',
      err2faRateLimited: 'به دلیل تلاش‌های ناموفق مکرر، ورود موقتاً قفل شد.',
      err2faInvalid: 'کد تایید یا کد بازیابی وارد شده نامعتبر است. دوباره تلاش کنید.',
      errMissingSignUpFields: 'وارد کردن ایمیل کاری و رمز عبور الزامی است.',
      errWeakPassword: 'رمز عبور انتخاب شده ضعیف است. لطفاً از رمز قوی‌تر شامل حروف، اعداد یا نمادها استفاده کنید.',
      errSignUpFailed: 'خطا در ثبت‌نام حساب جدید. لطفاً دوباره تلاش کنید.',
      msgEmailConfirmation: 'لینک تایید به ایمیل شما ارسال شد. لطفاً صندوق ورودی ایمیل خود را بررسی کنید.',
      themeLight: 'حالت روز',
      themeDark: 'حالت شب',
      switchToSignUpPrompt: 'هنوز کارگاه خود را ثبت نکرده‌اید؟',
      switchToSignInPrompt: 'قبلاً کارگاه خود را ثبت کرده‌اید؟'
    },
    ku: {
      versionBadge: 'وەشانی ٠.٩.٠',
      brandSubtitle: 'سیستەمی زیرەکی بەڕێوەبردنی کارگە، کارکرد و ژمێریاری دارایی',
      heroBadge: 'نەوەی نوێی بەڕێوەبردنی کارگە و پڕۆژە',
      heroTitle: 'بەڕێوەبردنی یەکگرتووی کارکرد، کرێ و ژمێریاری کارگە',
      heroDesc:
        'تۆمارکردنی خێرای شەفتی ڕۆژانە، هەژمارکردنی وردی زیادەکاری و پێشینەکان، دەرکردنی پسووڵەی پاکتاوکردن و پۆرتاڵی تایبەتی کرێکاران بە هاوکاتکردنی هەوری و ئۆفلاین.',
      feat1Title: 'تۆمارکردنی زیرەکی کارکرد و شەفت',
      feat1Desc: 'تۆمارکردنی تاک و گرووپی کارکردی ڕۆژانە بە پشتگیری تەواوی ئۆفلاین و هەوری',
      feat2Title: 'ئەندازیاری دارایی و مێزی پاکتاو',
      feat2Desc: 'بەڕێوەبردنی سندوق، خەرجی، پێشینە و پاکتاوکردنی ڕوون لەگەڵ کرێکاران',
      feat3Title: 'ئاسایشی چەندچین و پۆرتاڵی کرێکاران',
      feat3Desc: 'پشتڕاستکردنەوەی دوو هەنگاوی (2FA)، دەسەڵاتەکان و بەستەری تایبەتی کرێکار',
      securityFooter: 'پارێزراوە بە نهێنیکردنی هەوری و قفڵی ئاسایشی دوو هەنگاوی',
      signInTab: 'چوونەژوورەوە',
      signUpTab: 'تۆمارکردنی کارگەی نوێ',
      signInHeaderTitle: 'چوونەژوورەوە بۆ داشبۆردی کارگە',
      signInHeaderSubtitle: 'زانیارییەکانی هەژمارەکەت بنووسە بۆ چوونەژوورەوە',
      roleAdminTab: 'بەڕێوەبەران و خاوەنکاران',
      roleStaffTab: 'کارمەندان و کرێکارانی کارگە',
      adminEmailLabel: 'ئیمەیڵی کاری بەڕێوەبەر',
      adminEmailPlaceholder: 'manager@company.com',
      forgotPasswordLink: 'تێپەڕەوشەکەت لەبیرچووە؟',
      forgotModalTitle: 'گێڕانەوەی هەژمار و تێپەڕەوشە',
      forgotModalSubtitle: 'ئیمەیڵەکەت بنووسە بۆ ئەوەی بەستەری گۆڕینی تێپەڕەوشەت بۆ بنێردرێت',
      sendResetLinkBtn: 'ناردنی بەستەری گێڕانەوە',
      sendingResetLink: 'لە حاڵەتی ناردندا...',
      resetLinkSentMsg: 'بەستەری گێڕانەوەی تێپەڕەوشە بۆ ئیمەیڵەکەت نێردرا. تکایە سندوقی نامەکانت بپشکنە.',
      closeBtn: 'داخستن',
      errEmailRequired: 'تکایە ئیمەیڵی کارەکەت بنووسە.',
      errAdminSignInFields: 'تکایە ئیمەیڵ و تێپەڕەوشە بە تەواوی بنووسە.',
      signUpHeaderTitle: 'دروستکردنی کارگە و هەژماری بەڕێوەبەر',
      signUpHeaderSubtitle: 'لە کەمتر لە خولەکێکدا کارگە نوێیەکەت دابمەزرێنە',
      workspaceCodeLabel: 'کۆدی کارگە',
      workspaceCodeHint: 'کۆدی تایبەتی کارگە (نموونە: KARS-101)',
      identifierLabel: 'ئیمەیڵ، ناوی بەکارهێنەر یان کۆدی کرێکار',
      identifierPlaceholder: 'ناوی بەکارهێنەر، ئیمەیڵ یان کۆدی کرێکار',
      passwordLabel: 'تێپەڕەوشە',
      showPasswordTitle: 'پیشاندان یان شاردنەوەی تێپەڕەوشە',
      loginBtn: 'چوونەژوورەوە بۆ سیستەم',
      loggingIn: 'لە حاڵەتی چوونەژوورەوەدا...',
      workEmailLabel: 'ئیمەیڵی کار (هەژماری بەڕێوەبەر)',
      workEmailPlaceholder: 'manager@company.com',
      companyNameLabel: 'ناوی کارگە یان پڕۆژە',
      companyNamePlaceholder: 'نموونە: کارگەی بیناسازی نەورۆز',
      defaultCompanyName: 'کارگەکەم',
      managerNameLabel: 'ناوی تەواوی بەڕێوەبەر',
      managerNamePlaceholder: 'نموونە: ئەفشین زارعی',
      createAccountBtn: 'دروستکردنی کارگە و چوونەژوورەوە',
      creatingAccount: 'لە حاڵەتی دروستکردنی کارگەدا...',
      twoFaTitle: 'پشتڕاستکردنەوەی دوو هەنگاوی (2FA)',
      twoFaEmailTitle: 'پشتڕاستکردنەوەی تێپەڕەوشەی کاتی ئیمەیڵ',
      twoFaTotpDesc: 'کۆدی ٦ ژمارەیی ناو بەرنامەی پشتڕاستکردنەوەی دوو هەنگاوی بنووسە:',
      twoFaBackupDesc: 'یەکێک لە کۆدە فریاگوزارییە ٨ پیتییەکانت بنووسە:',
      twoFaEmailDesc: (email) => `تێپەڕەوشەی کاتیی ٦ ژمارەیی بۆ ئیمەیڵی ${email} نێردرا. تکایە بنووسە:`,
      resendOtpIn: (time) => `ناردنەوەی کۆد پاش ${time}`,
      resendOtpBtn: 'ناردنەوەی کۆدی پشتڕاستکردنەوە',
      msgOtpResent: 'کۆدی نوێ بۆ ئیمەیڵەکەت نێردرا.',
      totpPlaceholder: '٠٠٠٠٠٠',
      verifyAndSignIn: 'پشتڕاستکردنەوە و چوونەژوورەوە',
      useAuthenticatorApp: 'چوونەژوورەوە بە کۆدی ٦ ژمارەیی بەرنامەی پشتڕاستکردنەوە',
      useBackupCode: 'بەکارهێنانی کۆدی فریاگوزاری یەدەگ',
      backToSignIn: 'گەڕانەوە بۆ چوونەژوورەوە',
      lockoutBanner: (time) => `چوونەژوورەوە بە شێوەی کاتی قفڵ کراوە. کاتی ماوە: ${time}`,
      errAccountLocked: (time) => `هەژمارەکە بە شێوەی کاتی قفڵ کراوە. تکایە ${time} چاوەڕێ بکە.`,
      errMissingSignInFields: 'تکایە کۆدی کارگە، ناوی بەکارهێنەر و تێپەڕەوشە بە تەواوی بنووسە.',
      errRateLimited: 'هەوڵی هەڵەی زۆر درا. چوونەژوورەوە بۆ ماوەی ٥ خولەک قفڵ کرا.',
      errInvalidCredentials: 'کۆدی کارگە، ناوی بەکارهێنەر یان تێپەڕەوشە هەڵەیە.',
      errInvalidWorkspaceCode: 'کۆدی کارگە نەدۆزرایەوە. تکایە کۆدی کارگەکە بپشکنە.',
      errAccountBlocked: 'ئەم هەژمارە ناچالاک کراوە. تکایە پەیوەندی بە بەڕێوەبەری کارگەوە بکە.',
      errNetwork: 'هەڵە لە پەیوەستبوون بە سێرڤەر. تکایە هێڵی ئینتەرنێتەکەت بپشکنە.',
      errUserAlreadyExists: 'ئەم ئیمەیڵە پێشتر تۆمار کراوە. تکایە لە بەشی چوونەژوورەوە هەوڵ بدە.',
      errEmailNotConfirmed: 'ئیمەیڵەکەت هێشتا پشتڕاست نەکراوەتەوە. تکایە سندوقی ئیمەیڵەکەت بپشکنە.',
      errInvalidEmailFormat: 'شێوازی ئیمەیڵی نووسراو دروست نییە.',
      err2faRateLimited: 'بەهۆی هەوڵی هەڵەی بەردەوام، چوونەژوورەوە قفڵ کرا.',
      err2faInvalid: 'کۆدی پشتڕاستکردنەوە یان کۆدی یەدەگ هەڵەیە. دووبارە هەوڵ بدەوە.',
      errMissingSignUpFields: 'نووسینی ئیمەیڵی کار و تێپەڕەوشە پێویستە.',
      errWeakPassword: 'تێپەڕەوشەکە لاوازە. تکایە تێپەڕەوشەیەکی بەهێزتر بە پیت و ژمارە و هێما بەکاربهێنە.',
      errSignUpFailed: 'هەڵە لە تۆمارکردنی هەژماری نوێ. تکایە دووبارە هەوڵ بدەوە.',
      msgEmailConfirmation: 'بەستەری پشتڕاستکردنەوە بۆ ئیمەیڵەکەت نێردرا. تکایە سندوقی ئیمەیڵەکەت بپشکنە.',
      themeLight: 'دۆخی ڕۆژ',
      themeDark: 'دۆخی شەو',
      switchToSignUpPrompt: 'هێشتا کارگەکەت تۆمار نەکردووە؟',
      switchToSignInPrompt: 'پێشتر کارگەکەت تۆمار کردووە؟'
    },
    en: {
      versionBadge: 'v0.9.0',
      brandSubtitle: 'Smart Workshop Attendance, Payroll & Financial Engineering Suite',
      heroBadge: 'Next-Gen Workshop & Project ERP',
      heroTitle: 'Unified Attendance, Payroll & Financial Ledger',
      heroDesc:
        'Log daily shifts in seconds, automate overtime and advance calculations, issue clean settlement receipts, and empower workers with a dedicated live portal.',
      feat1Title: 'Smart Shift & Attendance Logging',
      feat1Desc: 'Individual and crew-based daily logging with seamless offline-first cloud sync',
      feat2Title: 'Financial Engineering & Settlement Desk',
      feat2Desc: 'Manage cashboxes, expenses, advances, and transparent worker settlements',
      feat3Title: 'Multi-Layer Security & Worker Portal',
      feat3Desc: 'Two-Factor Authentication (2FA), role-based access, and personal worker QR links',
      securityFooter: 'Protected by cloud encryption & Two-Factor Authentication',
      signInTab: 'Sign In',
      signUpTab: 'Create Workshop',
      signInHeaderTitle: 'Sign In to Workshop Hub',
      signInHeaderSubtitle: 'Enter your credentials to access your workspace',
      roleAdminTab: 'Managers & Owners',
      roleStaffTab: 'Workshop Staff & Crew',
      adminEmailLabel: 'Manager Work Email',
      adminEmailPlaceholder: 'manager@company.com',
      forgotPasswordLink: 'Forgot your password?',
      forgotModalTitle: 'Account & Password Recovery',
      forgotModalSubtitle: 'Enter your registered work email to receive a secure password reset link',
      sendResetLinkBtn: 'Send Recovery Link',
      sendingResetLink: 'Sending link...',
      resetLinkSentMsg: 'A password reset link has been dispatched to your email. Please check your inbox and spam folder.',
      closeBtn: 'Close',
      errEmailRequired: 'Please enter your work email.',
      errAdminSignInFields: 'Please enter both your work email and password.',
      signUpHeaderTitle: 'Create New Workshop Account',
      signUpHeaderSubtitle: 'Launch your workshop management workspace in under a minute',
      workspaceCodeLabel: 'Workspace Code',
      workspaceCodeHint: 'Your unique workshop ID (e.g. KARS-101)',
      identifierLabel: 'Email, Username or Worker ID',
      identifierPlaceholder: 'username or email@company.com',
      passwordLabel: 'Password',
      showPasswordTitle: 'Toggle password visibility',
      loginBtn: 'Sign In to Workspace',
      loggingIn: 'Signing in...',
      workEmailLabel: 'Work Email (Admin Account)',
      workEmailPlaceholder: 'manager@company.com',
      companyNameLabel: 'Workshop / Project Name',
      companyNamePlaceholder: 'e.g. Apex Construction Workshop',
      defaultCompanyName: 'My Workshop',
      managerNameLabel: 'Manager Full Name',
      managerNamePlaceholder: 'e.g. Alex Morgan',
      createAccountBtn: 'Create Workshop & Sign In',
      creatingAccount: 'Creating workspace...',
      twoFaTitle: 'Two-Factor Authentication (2FA)',
      twoFaEmailTitle: 'Email Verification Code',
      twoFaTotpDesc: 'Enter the 6-digit verification code from your Authenticator app:',
      twoFaBackupDesc: 'Enter one of your 8-character emergency recovery codes:',
      twoFaEmailDesc: (email) => `A 6-digit temporary code was sent to ${email}. Please enter it:`,
      resendOtpIn: (time) => `Resend code in ${time}`,
      resendOtpBtn: 'Resend verification code',
      msgOtpResent: 'A new verification code was sent to your email.',
      totpPlaceholder: '000000',
      verifyAndSignIn: 'Verify & Sign In',
      useAuthenticatorApp: 'Use 6-digit Authenticator code',
      useBackupCode: 'Use emergency backup code',
      backToSignIn: 'Back to Sign In',
      lockoutBanner: (time) => `Sign-in is temporarily locked. Time remaining: ${time}`,
      errAccountLocked: (time) => `Account is temporarily locked. Please wait ${time}.`,
      errMissingSignInFields: 'Please enter your workspace code, username/email, and password.',
      errRateLimited: 'Too many failed attempts. Sign-in is locked for 5 minutes.',
      errInvalidCredentials: 'Invalid workspace code, username, or password.',
      errInvalidWorkspaceCode: 'Workspace code not found. Please check your workshop code.',
      errAccountBlocked: 'This account has been deactivated. Please contact your workshop administrator.',
      errNetwork: 'Could not connect to server. Please check your internet connection.',
      errUserAlreadyExists: 'An account with this email already exists. Please sign in instead.',
      errEmailNotConfirmed: 'Your email is not confirmed yet. Please check your inbox.',
      errInvalidEmailFormat: 'Please enter a valid email address.',
      err2faRateLimited: 'Too many failed verification attempts. Sign-in locked.',
      err2faInvalid: 'Invalid verification or recovery code. Please try again.',
      errMissingSignUpFields: 'Work email and password are required.',
      errWeakPassword: 'Password is too weak. Please include letters, numbers, or symbols.',
      errSignUpFailed: 'Could not create account. Please try again.',
      msgEmailConfirmation: 'A verification link has been sent to your email. Please check your inbox.',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      switchToSignUpPrompt: "Don't have a workshop account yet?",
      switchToSignInPrompt: 'Already have a registered workshop?'
    }
  }[langKey];

  // Maps internal AuthContext error codes and raw Supabase errors to pure localized strings
  const localizeAuthError = (rawError, fallbackMsg) => {
    if (!rawError) return fallbackMsg;
    const errStr = String(rawError).trim();
    const lower = errStr.toLowerCase();

    if (errStr === 'invalidCredentials' || lower.includes('invalid login credentials')) {
      return copy.errInvalidCredentials;
    }
    if (errStr === 'invalidWorkspaceCode') {
      return copy.errInvalidWorkspaceCode;
    }
    if (errStr === 'accountBlocked') {
      return copy.errAccountBlocked;
    }
    if (errStr === 'networkError' || lower.includes('failed to fetch') || lower.includes('network')) {
      return copy.errNetwork;
    }
    if (errStr === 'missingCredentials') {
      return authMode === 'signup' ? copy.errMissingSignUpFields : copy.errMissingSignInFields;
    }
    if (errStr === 'rateLimited' || lower.includes('rate limit') || lower.includes('too many requests')) {
      return copy.errRateLimited;
    }
    if (errStr === 'invalid2FACode' || errStr === '2faNotActive') {
      return copy.err2faInvalid;
    }
    if (lower.includes('already registered') || lower.includes('already exists')) {
      return copy.errUserAlreadyExists;
    }
    if (lower.includes('email not confirmed')) {
      return copy.errEmailNotConfirmed;
    }
    if (lower.includes('invalid format') || lower.includes('invalid email')) {
      return copy.errInvalidEmailFormat;
    }
    if (lower.includes('password should be')) {
      return copy.errWeakPassword;
    }

    // Never leak raw English exception messages when UI is in Persian or Kurdish
    if (langKey !== 'en' && /^[A-Za-z0-9\s.,:;'?!()_-]+$/.test(errStr)) {
      return fallbackMsg;
    }
    return errStr;
  };

  useEffect(() => {
    const status = getLoginLockStatus();
    if (status.isLocked) {
      setRemainingSeconds(status.remainingSeconds);
    }

    // Check for Magic Link / QR Code credentials in URL
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w');
    const u = params.get('u');
    const p = params.get('p');
    if (w && u && p) {
      setWorkspaceCode(w);
      setIdentifier(u);
      setPassword(p);

      const autoLogin = async () => {
        setIsSubmitting(true);
        try {
          const res = await login(w, u, p);
          if (!res.success) {
            setErrorMessage(localizeAuthError(res.error, copy.errInvalidCredentials));
          }
        } catch (err) {
          setErrorMessage(localizeAuthError(err?.message, copy.errInvalidCredentials));
        } finally {
          setIsSubmitting(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };

      setTimeout(autoLogin, 500);
    }
  }, []);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const formatLockTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const raw = `${m}:${s.toString().padStart(2, '0')}`;
    return convertDigits ? convertDigits(raw, numberFormat) : raw;
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (remainingSeconds > 0) {
      setErrorMessage(copy.errAccountLocked(formatLockTime(remainingSeconds)));
      return;
    }

    if (loginRole === 'admin') {
      if (!identifier.trim() || !password.trim()) {
        setErrorMessage(copy.errAdminSignInFields);
        return;
      }
    } else {
      if (!workspaceCode.trim() || !identifier.trim() || !password.trim()) {
        setErrorMessage(copy.errMissingSignInFields);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // In admin mode, workspaceCode is optional / auto-detected
      const targetWorkspaceCode = loginRole === 'admin' ? '' : workspaceCode;
      const res = await login(targetWorkspaceCode, identifier, password);
      if (!res.success) {
        if (res.error === 'rateLimited') {
          setRemainingSeconds(res.remainingSeconds || 300);
          setErrorMessage(copy.errRateLimited);
        } else {
          setErrorMessage(localizeAuthError(res.error, copy.errInvalidCredentials));
        }
      } else if (res.requires2FA) {
        setAuthMode('2fa');
        setPendingEmail(res.email || (identifier.includes('@') ? identifier : ''));
        setTotpCode('');
        setIsUsingBackup(false);
        setResendCooldown(60);
      }
    } catch (err) {
      setErrorMessage(localizeAuthError(err?.message, copy.errInvalidCredentials));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FASubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');

    if (!totpCode.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await completeTwoFactorLogin(totpCode, pendingEmail);
      if (!res.success) {
        if (res.error === 'rateLimited') {
          setRemainingSeconds(300);
          setErrorMessage(copy.err2faRateLimited);
        } else {
          setErrorMessage(localizeAuthError(res.error, copy.err2faInvalid));
        }
      }
    } catch (err) {
      setErrorMessage(localizeAuthError(err?.message, copy.err2faInvalid));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending || !pendingEmail) return;
    setIsResending(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await resendEmailOtp(pendingEmail);
      if (res.success) {
        setSuccessMessage(copy.msgOtpResent);
        setResendCooldown(60);
      } else {
        setErrorMessage(localizeAuthError(res.error, copy.errNetwork));
      }
    } catch (err) {
      setErrorMessage(localizeAuthError(err?.message, copy.errNetwork));
    } finally {
      setIsResending(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!signupEmail.trim() || !signupPassword.trim()) {
      setErrorMessage(copy.errMissingSignUpFields);
      return;
    }

    const strength = evaluatePasswordStrength(signupPassword);
    if (!strength.isAcceptable) {
      setErrorMessage(copy.errWeakPassword);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp(signupEmail, signupPassword, {
        company_name: signupCompanyName.trim() || copy.defaultCompanyName,
        full_name: signupFullName.trim() || signupEmail.split('@')[0]
      });

      if (!res.success) {
        setErrorMessage(localizeAuthError(res.error, copy.errSignUpFailed));
      } else if (res.requires2FA) {
        setAuthMode('2fa');
        setPendingEmail(res.email || signupEmail);
        setTotpCode('');
        setResendCooldown(60);
        setSuccessMessage(copy.msgEmailConfirmation);
      } else if (res.message === 'checkEmailConfirmation') {
        setSuccessMessage(copy.msgEmailConfirmation);
      }
    } catch (err) {
      setErrorMessage(localizeAuthError(err?.message, copy.errSignUpFailed));
    } finally {
      setIsSubmitting(false);
    }
  };

  const languagesList = [
    { code: 'ku', label: 'کوردی' },
    { code: 'fa', label: 'فارسی' },
    { code: 'en', label: 'English' }
  ];

  const DirectionalArrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={direction}
      className="relative min-h-screen bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-2.5 sm:p-4 lg:p-6 overflow-x-hidden selection:bg-sky-500 selection:text-white transition-colors duration-300"
    >
      {/* Ambient Liquid Glass Glow Orbs */}
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-sky-500/12 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-indigo-500/12 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP FLOATING LIQUID GLASS CONTROL BAR                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Mini Brand Pill */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <img
            src="/karsync-icon.png"
            alt="KarSync"
            className="w-6 h-6 object-contain drop-shadow-xs"
          />
          <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
            KarSync
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            {copy.versionBadge}
          </span>
        </div>

        {/* Language & Theme Controls */}
        <div className="flex items-center gap-2">
          {/* Segmented Language Pill */}
          <div className="inline-flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] gap-1">
            <Languages className="w-3.5 h-3.5 text-slate-400 ms-2 me-0.5 hidden sm:block" />
            {languagesList.map((lang) => {
              const active = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => changeLanguage(lang.code)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-300 ease-in-out cursor-pointer ${
                    active
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Standalone Theme Button ([APP_THEME_BUTTON]) */}
          {toggleTheme && (
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? copy.themeLight : copy.themeDark}
              aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark}
              className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-sky-500/40 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-indigo-600" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN 12-COLUMN APPLE LIQUID GLASS WORKSPACE                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 w-full max-w-5xl mx-auto my-auto py-2 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">

          {/* =============================================================== */}
          {/* COLUMN A (5 COLS ON DESKTOP): EXECUTIVE HERO & FEATURE SHOWCASE */}
          {/* =============================================================== */}
          <div className="lg:col-span-5 relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl flex flex-col justify-between order-2 lg:order-1">
            {/* Internal Decorative Glows */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/25 text-sky-300 text-[10px] sm:text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>{copy.heroBadge}</span>
              </div>

              {/* Brand Hero Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md p-2 flex items-center justify-center shadow-lg">
                    <img
                      src="/karsync-logo.png"
                      alt="KarSync"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      KarSync
                    </h1>
                    <p className="text-xs text-sky-300/90 font-medium">
                      {copy.brandSubtitle}
                    </p>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug pt-1">
                  {copy.heroTitle}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300/85 leading-relaxed">
                  {copy.heroDesc}
                </p>
              </div>

              {/* 3 Glass Feature Capsules */}
              <div className="space-y-2 pt-0.5">
                <div className="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 backdrop-blur-md transition-all flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {copy.feat1Title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-300/80 mt-0.5 leading-relaxed">
                      {copy.feat1Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 backdrop-blur-md transition-all flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <WalletCards className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {copy.feat2Title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-300/80 mt-0.5 leading-relaxed">
                      {copy.feat2Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 backdrop-blur-md transition-all flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {copy.feat3Title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-300/80 mt-0.5 leading-relaxed">
                      {copy.feat3Desc}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Pill */}
            <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{copy.securityFooter}</span>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* COLUMN B (7 COLS ON DESKTOP): APPLE GLASS AUTHENTICATION CARD   */}
          {/* =============================================================== */}
          <div className="lg:col-span-7 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between order-1 lg:order-2">

            {/* Card Top Content */}
            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 flex-1">

              {/* Header Row + Segmented Mode Switcher ([APP_THEME_BUTTON]) */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {authMode === 'signin'
                      ? copy.signInHeaderTitle
                      : authMode === 'signup'
                      ? copy.signUpHeaderTitle
                      : pendingEmail
                      ? copy.twoFaEmailTitle
                      : copy.twoFaTitle}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {authMode === 'signin'
                      ? copy.signInHeaderSubtitle
                      : authMode === 'signup'
                      ? copy.signUpHeaderSubtitle
                      : pendingEmail
                      ? copy.twoFaEmailDesc(pendingEmail)
                      : isUsingBackup
                      ? copy.twoFaBackupDesc
                      : copy.twoFaTotpDesc}
                  </p>
                </div>

                {/* [APP_THEME_BUTTON] Segmented Control for SignIn / SignUp */}
                {authMode !== '2fa' && (
                  <div className="h-9 sm:h-10 inline-flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/90 p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      title={copy.signInTab}
                      aria-label={copy.signInTab}
                      className={`h-full flex items-center gap-2 rounded-xl transition-all duration-300 ease-in-out cursor-pointer ${
                        authMode === 'signin'
                          ? 'bg-sky-500 text-white font-bold px-3.5 shadow-md shadow-sky-500/25'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5'
                      }`}
                    >
                      <LogIn className="w-4 h-4 shrink-0" />
                      {authMode === 'signin' && (
                        <span className="text-xs whitespace-nowrap">{copy.signInTab}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      title={copy.signUpTab}
                      aria-label={copy.signUpTab}
                      className={`h-full flex items-center gap-2 rounded-xl transition-all duration-300 ease-in-out cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-sky-500 text-white font-bold px-3.5 shadow-md shadow-sky-500/25'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5'
                      }`}
                    >
                      <UserPlus className="w-4 h-4 shrink-0" />
                      {authMode === 'signup' && (
                        <span className="text-xs whitespace-nowrap">{copy.signUpTab}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Rate-Limit Lockout Banner */}
              {remainingSeconds > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/50 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2.5">
                  <Clock className="w-4.5 h-4.5 shrink-0 animate-spin text-amber-500" />
                  <span>{copy.lockoutBanner(formatLockTime(remainingSeconds))}</span>
                </div>
              )}

              {/* Error Alert Capsule */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-950/50 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Alert Capsule */}
              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/50 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-150">
                  <Check className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────── */}
              {/* MODE 1: SIGN IN FORM (ROLE-SEGREGATED: ADMIN VS STAFF)     */}
              {/* ─────────────────────────────────────────────────────────── */}
              {authMode === 'signin' && (
                <form id="karsync-auth-form" onSubmit={handleSignIn} className="space-y-3.5">
                  
                  {/* Role Selector Pill [APP_THEME_BUTTON] */}
                  <div className="p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginRole('admin');
                        setErrorMessage('');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                        loginRole === 'admin'
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{copy.roleAdminTab}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLoginRole('staff');
                        setErrorMessage('');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                        loginRole === 'staff'
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>{copy.roleStaffTab}</span>
                    </button>
                  </div>

                  {/* BRANCH A: STAFF / PERSONNEL LOGIN (Requires Workspace Code) */}
                  {loginRole === 'staff' && (
                    <>
                      {/* Featured Workspace Code Sub-Card */}
                      <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{copy.workspaceCodeLabel}</span>
                          </label>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {copy.workspaceCodeHint}
                          </span>
                        </div>
                        <input
                          type="text"
                          autoComplete="off"
                          autoFocus
                          value={workspaceCode}
                          onChange={(e) => setWorkspaceCode(e.target.value.toUpperCase())}
                          placeholder="KARS-101"
                          className="w-full px-3.5 py-2 sm:py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm sm:text-base font-black font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-center tracking-[0.2em] dir-ltr uppercase shadow-2xs"
                        />
                      </div>

                      {/* Staff Credentials Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-sky-500" />
                            <span>{copy.identifierLabel}</span>
                          </label>
                          <input
                            type="text"
                            autoComplete="username"
                            dir={identifier ? 'ltr' : direction}
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={copy.identifierPlaceholder}
                            className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all ${
                              identifier ? 'text-left' : 'text-start'
                            }`}
                          />
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <span>{copy.passwordLabel}</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-9 transition-all text-left dir-ltr"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              title={copy.showPasswordTitle}
                              aria-label={copy.showPasswordTitle}
                              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* BRANCH B: ADMIN / OWNER LOGIN (Direct Email & Password - No Workspace Code needed!) */}
                  {loginRole === 'admin' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      {/* Work Email */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-sky-500" />
                          <span>{copy.adminEmailLabel}</span>
                        </label>
                        <input
                          type="email"
                          autoComplete="email"
                          dir="ltr"
                          autoFocus
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder={copy.adminEmailPlaceholder}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-left"
                        />
                      </div>

                      {/* Password + Forgot Link */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <span>{copy.passwordLabel}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(identifier.includes('@') ? identifier : '');
                              setResetSentSuccess(false);
                              setShowForgotModal(true);
                            }}
                            className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            {copy.forgotPasswordLink}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-9 transition-all text-left dir-ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            title={copy.showPasswordTitle}
                            aria-label={copy.showPasswordTitle}
                            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </form>
              )}

              {/* ─────────────────────────────────────────────────────────── */}
              {/* MODE 2: TWO-FACTOR AUTHENTICATION (2FA) CHALLENGE           */}
              {/* ─────────────────────────────────────────────────────────── */}
              {authMode === '2fa' && (
                <form id="karsync-auth-form" onSubmit={handleVerify2FASubmit} className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="p-4 rounded-2xl bg-sky-500/5 dark:bg-sky-950/30 border border-sky-500/20 dark:border-sky-800/50 text-center space-y-2.5">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25">
                      {pendingEmail ? <Mail className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {pendingEmail
                          ? copy.twoFaEmailDesc(pendingEmail)
                          : isUsingBackup
                          ? copy.twoFaBackupDesc
                          : copy.twoFaTotpDesc}
                      </p>
                    </div>

                    <div className="max-w-xs mx-auto">
                      {isUsingBackup ? (
                        <input
                          type="text"
                          autoFocus
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          placeholder="XXXX-XXXX"
                          required
                          className="w-full text-center tracking-widest font-mono text-base font-bold px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 uppercase"
                        />
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoFocus
                          value={totpCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setTotpCode(val);
                          }}
                          placeholder={copy.totpPlaceholder}
                          required
                          className="w-full text-center tracking-[0.45em] font-mono text-xl font-black px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-sky-500/40 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-sky-500 shadow-inner"
                        />
                      )}
                    </div>

                    {/* Resend OTP button with countdown timer */}
                    {pendingEmail && (
                      <div className="pt-1 flex items-center justify-center text-xs">
                        {resendCooldown > 0 ? (
                          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{copy.resendOtpIn(formatLockTime(resendCooldown))}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={isResending}
                            className="font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                            <span>{copy.resendOtpBtn}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 px-1">
                    {!pendingEmail ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUsingBackup(!isUsingBackup);
                          setTotpCode('');
                          setErrorMessage('');
                        }}
                        className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>
                          {isUsingBackup ? copy.useAuthenticatorApp : copy.useBackupCode}
                        </span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        cancelTwoFactorLogin?.();
                        setAuthMode('signin');
                        setPendingEmail('');
                        setTotpCode('');
                        setErrorMessage('');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {copy.backToSignIn}
                    </button>
                  </div>
                </form>
              )}

              {/* ─────────────────────────────────────────────────────────── */}
              {/* MODE 3: SIGN UP FORM (2-COLUMN RESPONSIVE GRID)             */}
              {/* ─────────────────────────────────────────────────────────── */}
              {authMode === 'signup' && (
                <form id="karsync-auth-form" onSubmit={handleSignUp} className="space-y-3">
                  {/* Row 1: Workshop Name & Manager Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{copy.companyNameLabel}</span>
                      </label>
                      <input
                        type="text"
                        value={signupCompanyName}
                        onChange={(e) => setSignupCompanyName(e.target.value)}
                        placeholder={copy.companyNamePlaceholder}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                      />
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{copy.managerNameLabel}</span>
                      </label>
                      <input
                        type="text"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        placeholder={copy.managerNamePlaceholder}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Work Email & Password + Strength Meter */}
                  <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-sky-500" />
                          <span>{copy.workEmailLabel} *</span>
                        </label>
                        <input
                          type="email"
                          required
                          autoFocus
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder={copy.workEmailPlaceholder}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-left dir-ltr"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{copy.passwordLabel} *</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showSignupPassword ? 'text' : 'password'}
                            required
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-9 transition-all text-left dir-ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                            title={copy.showPasswordTitle}
                            aria-label={copy.showPasswordTitle}
                            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Live Password Strength Meter */}
                    <PasswordStrengthMeter password={signupPassword} showChecks={false} />
                  </div>
                </form>
              )}

            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* STICKY GLASS BOTTOM ACTION DOCK                               */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              {/* Left/Start Context Switch Helper */}
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-start">
                {authMode === 'signin' && (
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                    <span>{copy.switchToSignUpPrompt}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {copy.signUpTab}
                    </button>
                  </div>
                )}
                {authMode === 'signup' && (
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                    <span>{copy.switchToSignInPrompt}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {copy.signInTab}
                    </button>
                  </div>
                )}
                {authMode === '2fa' && (
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {pendingEmail ? copy.twoFaEmailTitle : copy.twoFaTitle}
                  </span>
                )}
              </div>

              {/* Right/End Primary Submit Button */}
              <button
                type="submit"
                form="karsync-auth-form"
                disabled={
                  isSubmitting ||
                  (authMode === 'signin' && remainingSeconds > 0) ||
                  (authMode === '2fa' && !totpCode.trim())
                }
                className={`w-full sm:w-auto min-w-[190px] py-2.5 sm:py-3 px-5 rounded-xl sm:rounded-2xl font-extrabold text-xs sm:text-sm text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
                  authMode === 'signup'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 shadow-sky-500/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{authMode === 'signup' ? copy.creatingAccount : copy.loggingIn}</span>
                  </>
                ) : authMode === '2fa' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{copy.verifyAndSignIn}</span>
                  </>
                ) : authMode === 'signup' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{copy.createAccountBtn}</span>
                    <DirectionalArrow className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{copy.loginBtn}</span>
                    <DirectionalArrow className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. SUBTLE FOOTER                                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto text-center py-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          {t('ownerName')} • {t('allRightsReserved')}
        </p>
      </footer>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. FORGOT PASSWORD MODAL (Apple Liquid Glass)                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.2)] space-y-4 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {copy.forgotModalTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {copy.forgotModalSubtitle}
                  </p>
                </div>
              </div>
            </div>

            {resetSentSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{copy.resetLinkSentMsg}</span>
                </div>
                <div className="pt-2 text-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {copy.closeBtn}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!forgotEmail.trim()) {
                    setErrorMessage(copy.errEmailRequired);
                    return;
                  }
                  setIsSendingReset(true);
                  try {
                    const res = await resetPassword(forgotEmail.trim().toLowerCase());
                    if (res.success) {
                      setResetSentSuccess(true);
                    } else {
                      setErrorMessage(res.error || copy.errNetwork);
                    }
                  } catch (err) {
                    setErrorMessage(err?.message || copy.errNetwork);
                  } finally {
                    setIsSendingReset(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-500" />
                    <span>{copy.adminEmailLabel}</span>
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="manager@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {copy.closeBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset || !forgotEmail.trim()}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingReset ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{copy.sendingResetLink}</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{copy.sendResetLinkBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
