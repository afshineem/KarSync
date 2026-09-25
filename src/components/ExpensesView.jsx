import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { Receipt, PlusCircle, Calendar, Tags, CreditCard, ShoppingBag, Edit2, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export function ExpensesView() {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Fallback to IQD if base_currency is undefined
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  const formatProjectCurrency = (amount) => {
    try {
      if (currency === 'IRT') return `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`;
      if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  };

  const expenses = useLiveQuery(
    async () => {
      if (!currentProject?.id) return [];
      const list = await db.projectExpenses
        .where('projectId').equals(currentProject.id)
        .toArray();
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    [currentProject?.id]
  ) || [];

  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const handleDelete = async (id) => {
    if (window.confirm('آیا از حذف این هزینه اطمینان دارید؟')) {
      await db.projectExpenses.delete(id);
    }
  };

  const handleEdit = (exp) => {
    setEditingExpense(exp);
    setAddModalOpen(true);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Receipt className="text-rose-500"/> مدیریت هزینه‌های عمومی
        </h1>
        <button 
          onClick={() => {
            setEditingExpense(null);
            setAddModalOpen(true);
          }}
          className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-sky-600/30 flex items-center gap-2 transition-transform hover:scale-105"
        >
          <PlusCircle className="w-5 h-5"/> ثبت هزینه
        </button>
      </div>

      <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-8 rounded-3xl shadow-xl shadow-rose-500/20 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShoppingBag className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <p className="text-rose-100 font-bold text-sm mb-2 tracking-wide">مجموع هزینه‌های ثبت شده پروژه</p>
          <h2 className="text-4xl font-black font-mono tracking-tight">
            {formatProjectCurrency(totalExpenses)}
          </h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
             <Receipt className="w-16 h-16 mb-4 opacity-20" />
             <p className="font-bold text-lg text-slate-500 dark:text-slate-400">هیچ هزینه‌ای ثبت نشده است</p>
             <p className="text-sm mt-1">هزینه‌های مربوط به مصالح، تجهیزات و ... را اینجا ثبت کنید.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map(exp => (
              <li key={exp.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 shadow-inner">
                    <CreditCard className="w-6 h-6"/>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{exp.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                      <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg"><Calendar className="w-3.5 h-3.5"/> {exp.date}</span>
                      <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg"><Tags className="w-3.5 h-3.5"/> {exp.category || 'عمومی'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <div className="text-left bg-rose-50 dark:bg-rose-950/30 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-900/50">
                    <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-lg tracking-tight">
                      {formatProjectCurrency(exp.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEdit(exp)}
                      className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(exp.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAddModalOpen && (
        <AddExpenseModal 
          onClose={() => setAddModalOpen(false)} 
          expenseToEdit={editingExpense} 
        />
      )}
    </div>
  );
}

function AddExpenseModal({ onClose, expenseToEdit }) {
  const { currentProject } = useProject();
  const [formData, setFormData] = useState(
    expenseToEdit || {
      title: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: 'مصالح'
    }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;
    
    if (expenseToEdit) {
      await db.projectExpenses.update(expenseToEdit.id, {
        title: formData.title,
        amount: Number(formData.amount),
        date: formData.date,
        category: formData.category
      });
    } else {
      await db.projectExpenses.add({
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        projectId: currentProject.id,
        title: formData.title,
        amount: Number(formData.amount),
        date: formData.date,
        category: formData.category,
        createdAt: new Date().toISOString()
      });
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 print:p-0">
      <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-none sm:rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 h-[100dvh] sm:h-auto overflow-y-auto">
        <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100 flex items-center gap-2">
           <PlusCircle className="text-rose-500"/> {expenseToEdit ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان هزینه</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all text-slate-900 dark:text-white" placeholder="مثلا: خرید سیمان"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مبلغ</label>
              <input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 dark:text-white" placeholder="0"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاریخ</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">دسته‌بندی</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 dark:text-white">
              <option value="مصالح">مصالح و مواد</option>
              <option value="تجهیزات">تجهیزات و ابزار</option>
              <option value="خوراک">خوراک گروهی</option>
              <option value="متفرقه">متفرقه</option>
            </select>
          </div>
          <div className="flex gap-3 mt-6 pt-2">
            <button type="submit" className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-500/30 transition-colors">
              {expenseToEdit ? 'ذخیره تغییرات' : 'ثبت هزینه'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
