import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { 
  FolderKanban, 
  ChevronDown, 
  Plus, 
  Settings2, 
  Check,
  Building
} from 'lucide-react';

export function ProjectSwitcher() {
  const { t } = useLanguage();
  const { 
    activeProjects, 
    currentProject, 
    switchProject,
    setIsNewProjectModalOpen,
    setIsProjectSettingsModalOpen
  } = useProject();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currencyBadgeColors = {
    IQD: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    IRT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    USD: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  };

  return (
    <div className="relative inline-block text-right" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-slate-100/90 hover:bg-white dark:bg-slate-700/60 dark:hover:bg-slate-600/60 border border-slate-200/90 dark:border-slate-600/60 shadow-xs transition-all text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 group"
      >
        <FolderKanban className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
        
        <span className="font-semibold max-w-[110px] sm:max-w-[160px] truncate">
          {currentProject?.name || t('selectProject') || 'انتخاب پروژه'}
        </span>

        {currentProject?.currency && (
          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono border ${
            currencyBadgeColors[currentProject.currency] || currencyBadgeColors.IQD
          }`}>
            {currentProject.currency}
          </span>
        )}

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-xl py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-700/60">
          
          {/* Header title */}
          <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center justify-between">
            <span>{t('projects') || 'پروژه‌ها و کارگاه‌ها'}</span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
              {activeProjects.length}
            </span>
          </div>

          {/* Project List */}
          <div className="py-1 max-h-56 overflow-y-auto">
            {activeProjects.map((p) => {
              const isSelected = p.id === currentProject?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    switchProject(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-right px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'
                    }`} />
                    <span className="truncate">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border ${
                      currencyBadgeColors[p.currency] || currencyBadgeColors.IQD
                    }`}>
                      {p.currency}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions: New Project & Project Settings */}
          <div className="pt-1.5 px-1.5 space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsNewProjectModalOpen(true);
              }}
              className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createNewProject') || 'ایجاد پروژه جدید'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsProjectSettingsModalOpen(true);
              }}
              className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
            >
              <Settings2 className="w-4 h-4 text-slate-500" />
              <span>{t('manageProjectSettings') || 'تنظیمات این پروژه'}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
