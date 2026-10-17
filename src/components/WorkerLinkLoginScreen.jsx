import React from 'react';
import { Loader2, ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const MESSAGES = {
  fa: {
    loadingTitle: 'در حال ورود به پروفایل شما…',
    loadingSub: 'لطفاً چند لحظه صبر کنید.',
    retryBtn: 'تلاش دوباره',
    goToLoginBtn: 'رفتن به صفحه ورود',
    invalid_token: {
      title: 'لینک معتبر نیست',
      text: 'این لینک اشتباه است یا توسط مدیر کارگاه لغو شده است. لطفاً لینک یا بارکد جدید را از مدیر کارگاه بگیرید.'
    },
    account_blocked: {
      title: 'حساب غیرفعال است',
      text: 'دسترسی شما توسط مدیر کارگاه غیرفعال شده است. لطفاً با مدیر کارگاه تماس بگیرید.'
    },
    offline: {
      title: 'اتصال اینترنت برقرار نیست',
      text: 'برای اولین ورود، اینترنت لازم است. اتصال خود را بررسی کنید و دوباره تلاش کنید.',
      retry: true
    },
    network: {
      title: 'خطا در اتصال به سرور',
      text: 'ارتباط با سرور برقرار نشد. چند لحظه بعد دوباره تلاش کنید.',
      retry: true
    },
    timeout: {
      title: 'اتصال خیلی کند است',
      text: 'پاسخ سرور دیر رسید. اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
      retry: true
    },
    local_db: {
      title: 'ذخیره‌ی اطلاعات روی این گوشی ممکن نشد',
      text: 'اگر برنامه در تب یا پنجره‌ی دیگری باز است آن را ببندید، سپس دوباره تلاش کنید. اگر نشد، حالت «ناشناس/خصوصی» مرورگر را خاموش کنید یا از مرورگر دیگری استفاده کنید.',
      retry: true
    },
    not_configured: {
      title: 'سرور هنوز آماده نیست',
      text: 'قابلیت ورود با لینک هنوز روی سرور فعال نشده است. لطفاً به مدیر کارگاه اطلاع دهید.'
    }
  },
  ku: {
    loadingTitle: 'لە حاڵەتی چوونەژوورەوە بۆ پڕۆفایلەکەت…',
    loadingSub: 'تکایە چەند چرکەیەک چاوەڕێ بکە.',
    retryBtn: 'هەوڵدانەوەی دووبارە',
    goToLoginBtn: 'چوون بۆ پەڕەی چوونەژوورەوە',
    invalid_token: {
      title: 'بەستەرەکە دروست نییە',
      text: 'ئەم بەستەرە هەڵەیە یان لەلایەن بەڕێوەبەری کارگەوە هەڵوەشێنراوەتەوە. تکایە بەستەر یان بارکۆدی نوێ لە بەڕێوەبەری کارگە وەربگرە.'
    },
    account_blocked: {
      title: 'هەژمارەکە ناچالاکە',
      text: 'دەستڕاگەیشتنت لەلایەن بەڕێوەبەری کارگەوە ناچالاک کراوە. تکایە پەیوەندی بە بەڕێوەبەری کارگەوە بکە.'
    },
    offline: {
      title: 'هێڵی ئینتەرنێت نییە',
      text: 'بۆ یەکەم چوونەژوورەوە، ئینتەرنێت پێویستە. هێڵەکەت بپشکنە و دووبارە هەوڵ بدەوە.',
      retry: true
    },
    network: {
      title: 'هەڵە لە پەیوەستبوون بە سێرڤەر',
      text: 'پەیوەندی لەگەڵ سێرڤەر دروست نەبوو. پاش کەمێکی تر دووبارە هەوڵ بدەوە.',
      retry: true
    },
    timeout: {
      title: 'هێڵی ئینتەرنێت زۆر خاوە',
      text: 'وەڵامی سێرڤەر دواکەوت. ئینتەرنێتەکەت بپشکنە و دووبارە هەوڵ بدەوە.',
      retry: true
    },
    local_db: {
      title: 'پاشەکەوتکردنی زانیاری لەسەر ئەم مۆبایلە سەرنەکەوت',
      text: 'ئەگەر بەرنامەکە لە تاب یان پەنجەرەیەکی تردا کراوەتەوە دایبخە و دووبارە هەوڵ بدەوە. ئەگەر چاک نەبوو، دۆخی نهێنی (Private/Incognito) لە وێبگەڕەکەت بکوژێنەوە.',
      retry: true
    },
    not_configured: {
      title: 'سێرڤەر هێشتا ئامادە نییە',
      text: 'تایبەتمەندی چوونەژوورەوە بە بەستەر هێشتا لەسەر سێرڤەر چالاک نەکراوە. تکایە بەڕێوەبەری کارگە ئاگادار بکەوە.'
    }
  },
  en: {
    loadingTitle: 'Signing in to your profile…',
    loadingSub: 'Please wait a moment.',
    retryBtn: 'Try Again',
    goToLoginBtn: 'Go to Sign In Page',
    invalid_token: {
      title: 'Invalid Access Link',
      text: 'This link is invalid or has been revoked by the workshop manager. Please request a new link or QR code from your manager.'
    },
    account_blocked: {
      title: 'Account Deactivated',
      text: 'Your access has been disabled by the workshop manager. Please contact your manager.'
    },
    offline: {
      title: 'No Internet Connection',
      text: 'An internet connection is required for your first sign-in. Please check your connection and try again.',
      retry: true
    },
    network: {
      title: 'Server Connection Error',
      text: 'Could not reach the server. Please wait a moment and try again.',
      retry: true
    },
    timeout: {
      title: 'Connection Timed Out',
      text: 'The server took too long to respond. Please check your internet connection and try again.',
      retry: true
    },
    local_db: {
      title: 'Could Not Save Data on This Device',
      text: 'If the app is open in another tab or window, close it and try again. Otherwise, disable Private/Incognito browsing mode or use another browser.',
      retry: true
    },
    not_configured: {
      title: 'Server Not Configured',
      text: 'Access link sign-in is not yet enabled on the server. Please notify your workshop manager.'
    }
  }
};

/**
 * Shown while a worker's personal link / QR code is being verified (so the login page
 * is never displayed), or when the link could not be used.
 */
export function WorkerLinkLoginScreen({ status, error, detail, onRetry, onDismiss }) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const dict = MESSAGES[langKey];
  const msg = dict[error] || dict.invalid_token;

  return (
    <div
      dir={direction}
      className="min-h-screen flex items-center justify-center p-6 bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      <div className="w-full max-w-sm bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 text-center">
        {status === 'loading' ? (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-sky-500" />
            <h1 className="font-bold text-lg mb-1">{dict.loadingTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.loadingSub}</p>
          </>
        ) : (
          <>
            {error === 'offline' || error === 'network' ? (
              <WifiOff className="w-10 h-10 mx-auto mb-4 text-amber-500" />
            ) : (
              <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-red-500" />
            )}
            <h1 className="font-bold text-lg mb-2">{msg.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{msg.text}</p>
            {detail && langKey === 'en' && (
              <p dir="ltr" className="text-[10px] text-slate-400 break-words mb-4 font-mono select-all">
                {String(detail).slice(0, 160)}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {msg.retry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {dict.retryBtn}
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {dict.goToLoginBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
