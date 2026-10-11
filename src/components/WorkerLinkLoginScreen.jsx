import React from 'react';
import { Loader2, ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';

const MESSAGES = {
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
};

/**
 * Shown while a worker's personal link / QR code is being verified (so the login page
 * is never displayed), or when the link could not be used.
 */
export function WorkerLinkLoginScreen({ status, error, detail, onRetry, onDismiss }) {
  const msg = MESSAGES[error] || MESSAGES.invalid_token;

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 text-center">
        {status === 'loading' ? (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-sky-500" />
            <h1 className="font-bold text-lg mb-1">در حال ورود به پروفایل شما…</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">لطفاً چند لحظه صبر کنید.</p>
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
            {detail && (
              <p dir="ltr" className="text-[10px] text-slate-400 break-words mb-4 font-mono select-all">
                {String(detail).slice(0, 160)}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {msg.retry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  تلاش دوباره
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                رفتن به صفحه ورود
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
