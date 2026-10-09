import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { AddCounterpartyModal } from './AddCounterpartyModal';
import { 
  Briefcase, 
  Plus, 
  Search,
  User,
  Phone,
  Building2,
  Trash2,
  Edit2
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export function CounterpartiesView() {
  const { language } = useLanguage();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCounterparty, setEditingCounterparty] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const counterparties = useLiveQuery(() => db.counterparties.toArray()) || [];
  
  const filteredCounterparties = counterparties.filter(cp => 
    cp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cp.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id, name) => {
    const confirmMsg = language === 'fa' 
      ? `آیا از حذف طرف‌حساب "${name}" اطمینان دارید؟` 
      : `دڵنیایت لە سڕینەوەی "${name}"؟`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await db.counterparties.delete(id);
      } catch (err) {
        console.error('Error deleting counterparty:', err);
      }
    }
  };

  const getTypeName = (type) => {
    if (language !== 'fa') return type; // Simplify for Sorani/other languages for now
    switch(type) {
      case 'employer': return 'کارفرما / سرمایه‌گذار';
      case 'supplier': return 'تامین‌کننده';
      case 'subcontractor': return 'پیمانکار فرعی';
      default: return 'سایر';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            {language === 'fa' ? 'مدیریت طرف‌حساب‌ها' : 'لایەنەکانی حیساب'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {language === 'fa' 
              ? 'کارفرمایان، تامین‌کنندگان و اشخاص مرتبط با امور مالی پروژه' 
              : 'خاوەن کارەکان و دابینکەران'}
          </p>
        </div>

        <button 
          onClick={() => {
            setEditingCounterparty(null);
            setIsAddModalOpen(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30"
        >
          <Plus className="w-5 h-5" />
          {language === 'fa' ? 'تعریف طرف‌حساب جدید' : 'لایەنی نوێ'}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'fa' ? 'جستجو در نام یا شرکت...' : 'گەڕان...'}
          className="block w-full pr-10 pl-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all sm:text-sm"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCounterparties.map(cp => (
          <div key={cp.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">{cp.name}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    {getTypeName(cp.type)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingCounterparty(cp);
                    setIsAddModalOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cp.id, cp.name)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mt-4 text-sm text-slate-600 dark:text-slate-400">
              {cp.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{cp.company}</span>
                </div>
              )}
              {cp.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{cp.phone}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {filteredCounterparties.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>{language === 'fa' ? 'هیچ طرف‌حسابی یافت نشد.' : 'هیچ لایەنێک نەدۆزرایەوە.'}</p>
          </div>
        )}
      </div>

      <AddCounterpartyModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCounterparty(null);
        }}
        editingCounterparty={editingCounterparty}
      />
    </div>
  );
}
