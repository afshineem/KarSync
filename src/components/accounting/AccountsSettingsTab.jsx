import React, { useState, useMemo } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { AddEditAccountModal } from './AddEditAccountModal';
import { 
  CreditCard, 
  Coins, 
  Plus, 
  Star, 
  Edit2, 
  Trash2, 
  Check, 
  Building2, 
  User, 
  Landmark, 
  AlertTriangle,
  Layers,
  Sparkles,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { migrateClosedTransactionsToCashBox } from '../../db/db';
import { pushPaymentsLive, pushAllExpensesToCloud } from '../../services/realtimeSync';

/**
 * AccountsSettingsTab
 * تب مدیریت حساب‌های بانکی و صندوق‌های نقدی
 * قابل استفاده هم در پنجره تنظیمات سراسری (GlobalSettingsModal) و هم در تب حسابداری
 */
export function AccountsSettingsTab({
  accounts = [],
  onAddAccount,
  onUpdateAccount,
  onSetDefaultAccount,
  onDeleteAccount,
  currency = 'IQD',
  language = 'fa'
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'bank' | 'cash'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const handleMigratePastTransactions = async () => {
    try {
      setIsMigrating(true);
      const res = await migrateClosedTransactionsToCashBox(undefined, true);
      pushPaymentsLive().catch(() => {});
      pushAllExpensesToCloud().catch(() => {});
      setMigrationStatus({
        type: 'success',
        message: language === 'fa'
          ? `عملیات با موفقیت انجام شد: ${res.updatedPaymentsCount} پرداختی پرسنل و ${res.updatedExpensesCount} هزینه فاکتور از محل صندوق نقدی کارگاه ثبت و پرداخت شدند.`
          : 'سەرکەوتوو بوو.'
      });
      setTimeout(() => setMigrationStatus(null), 6000);
    } catch (err) {
      setMigrationStatus({
        type: 'error',
        message: err.message || 'خطا در اعمال عملیات'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (activeFilter === 'all') return accounts;
    return accounts.filter((a) => a.type === activeFilter);
  }, [accounts, activeFilter]);

  const bankAccountsCount = useMemo(() => accounts.filter((a) => a.type === 'bank').length, [accounts]);
  const cashAccountsCount = useMemo(() => accounts.filter((a) => a.type === 'cash').length, [accounts]);

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    try {
      await onDeleteAccount(accountToDelete.id);
      setAccountToDelete(null);
    } catch (err) {
      alert(err.message || 'خطا در حذف حساب');
    }
  };

  // رنگ پس‌زمینه گرادیان کارت‌ها
  const getCardGradient = (color, type) => {
    if (type === 'cash') {
      return 'from-amber-500 to-amber-700 text-white';
    }
    switch (color) {
      case 'sky':
        return 'from-sky-500 to-sky-700 text-white';
      case 'indigo':
        return 'from-indigo-500 to-indigo-700 text-white';
      case 'emerald':
        return 'from-emerald-500 to-emerald-700 text-white';
      case 'rose':
        return 'from-rose-500 to-rose-700 text-white';
      case 'purple':
        return 'from-purple-500 to-purple-700 text-white';
      case 'slate':
      default:
        return 'from-slate-700 to-slate-900 text-white';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* هدر بخش و دکمه افزودن حساب */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-500" />
            <span>{language === 'fa' ? 'مدیریت کارت‌های بانکی و صندوق‌های نقدی' : 'بەڕێوەبردنی کارتی بانکی و سندوقەکان'}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'fa' 
              ? 'تعریف حساب‌های بانکی، صندوق‌ها و تعیین حساب پیش‌فرض برای پرداخت‌ها و واریزی‌ها' 
              : 'دیاریکردنی کارتی بانکی و سندوقی تەنخوا و حیسابی سەرەکی'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition-all self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'fa' ? 'افزودن حساب / کارت جدید' : 'زیادکردنی حیسابی نوێ'}</span>
        </button>
      </div>

      {/* پیام بازخورد عملیات انتساب */}
      {migrationStatus && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
          migrationStatus.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          {migrationStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{migrationStatus.message}</span>
        </div>
      )}

      {/* بنر عملیات: پرداخت تراکنش‌های قبلی از محل صندوق */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {language === 'fa' ? 'انتساب تراکنش‌های بسته شده قبلی به صندوق نقدی' : 'گواستنەوەی مامەڵە کۆنەکان بۆ سندوقی کاش'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fa' 
                ? 'تمام تسویه‌حساب‌ها، مساعده‌ها و فاکتورهای پرداخت‌شده قبلی را از محل «صندوق نقدی کارگاه» لحاظ و ثبت می‌کند.'
                : 'هەموو تەسویە و خەرجییە دراوەکانی پێشوو دەخرێنە سەر سندوقی کاش.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isMigrating}
          onClick={handleMigratePastTransactions}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs active:scale-95"
        >
          {isMigrating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{language === 'fa' ? 'در حال اعمال...' : 'جێبەجێکردن...'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'پرداخت از محل صندوق' : 'جێبەجێکردن'}</span>
            </>
          )}
        </button>
      </div>

      {/* فیلتر تب‌ها (همه، کارت‌ها، صندوق‌ها) */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>{language === 'fa' ? 'همه حساب‌ها' : 'هەموو'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
            {accounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('bank')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'bank'
              ? 'bg-sky-500 text-white shadow-xs shadow-sky-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>{language === 'fa' ? 'کارت‌های بانکی' : 'کارتەکان'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 dark:bg-sky-950 font-mono">
            {bankAccountsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('cash')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'cash'
              ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>{language === 'fa' ? 'صندوق‌های نقدی' : 'سندوقەکان'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 font-mono">
            {cashAccountsCount}
          </span>
        </button>
      </div>

      {/* لیست کارت‌ها و صندوق‌ها */}
      {filteredAccounts.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mb-3">
            <Landmark className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {language === 'fa' ? 'هیچ حسابی در این دسته یافت نشد' : 'هیچ حیسابێک نییە'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {language === 'fa' ? 'جهت تسریع در ثبت مخارج و تفکیک جریان نقدینگی، کارت یا صندوق جدیدی اضافه کنید.' : 'حیسابێک زیاد بکە.'}
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'fa' ? 'تعریف حساب جدید' : 'زیادکردنی حیساب'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const isBank = account.type === 'bank';
            const isDefault = Boolean(account.isDefault);

            return (
              <div
                key={account.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* نمای کارتی بالایی (مشابه کارت اعتباری / صندوق) */}
                <div className={`p-5 bg-gradient-to-br ${getCardGradient(account.color, account.type)} relative overflow-hidden`}>
                  {/* دایره‌های تزیینی گرافیکی کارت */}
                  <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                  <div className="absolute right-12 -bottom-10 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

                  {/* ردیف بالا: نوع و نشان پیش‌فرض */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md">
                      {isBank ? <CreditCard className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                      <span>{isBank ? (account.bankName || 'کارت بانکی') : 'صندوق نقدی'}</span>
                    </span>

                    {isDefault && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 shadow-xs">
                        <Star className="w-3 h-3 fill-amber-950" />
                        <span>حساب پیش‌فرض</span>
                      </span>
                    )}
                  </div>

                  {/* نام حساب */}
                  <div className="mt-4 relative z-10">
                    <h4 className="font-black text-base tracking-tight leading-snug drop-shadow-xs">
                      {account.name}
                    </h4>
                    {isBank && account.cardNumber && (
                      <div className="font-mono text-sm tracking-wider mt-2 opacity-90 drop-shadow-xs" dir="ltr">
                        {account.cardNumber}
                      </div>
                    )}
                  </div>

                  {/* جزییات پایین کارت: صاحب حساب یا مسئول */}
                  <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] opacity-90 relative z-10">
                    <span>
                      {isBank ? (account.holderName ? `صاحب کارت: ${account.holderName}` : 'حساب بانکی کارگاه') : (account.keeperName ? `مسئول: ${account.keeperName}` : 'صندوق کارگاه')}
                    </span>
                    {account.initialBalance > 0 && (
                      <span className="font-mono font-bold">
                        اولیه: {formatAmount(account.initialBalance, currency)}
                      </span>
                    )}
                  </div>
                </div>

                {/* پنل عملیات و دکمه‌ها در پایین */}
                <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-2 text-xs">
                  {/* دکمه تنظیم به عنوان پیش‌فرض */}
                  {!isDefault ? (
                    <button
                      type="button"
                      onClick={() => onSetDefaultAccount(account.id)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{language === 'fa' ? 'تنظیم پیش‌فرض' : 'دانان وەک سەرەکی'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>پیش‌فرض فعال</span>
                    </span>
                  )}

                  {/* دکمه‌های ویرایش و حذف */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      title={language === 'fa' ? 'ویرایش حساب' : 'دەستکاری'}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(account)}
                      title={language === 'fa' ? 'حذف حساب' : 'سڕینەوە'}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* مودال افزودن حساب */}
      {isAddModalOpen && (
        <AddEditAccountModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddAccount}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال ویرایش حساب */}
      {editingAccount && (
        <AddEditAccountModal
          isOpen={Boolean(editingAccount)}
          onClose={() => setEditingAccount(null)}
          onSave={(data) => onUpdateAccount(editingAccount.id, data)}
          initialData={editingAccount}
          currency={currency}
          language={language}
        />
      )}

      {/* دیالوگ تأیید حذف حساب */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'fa' ? 'آیا از حذف این حساب مطمئن هستید؟' : 'دڵنیایت لە سڕینەوە؟'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {accountToDelete.name}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {language === 'fa' ? 'حذف قطعی' : 'سڕینەوە'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
