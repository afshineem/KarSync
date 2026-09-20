import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { 
  FolderKanban, 
  ChevronDown, 
  Plus, 
  Settings2, 
  Check,
  Building,
  Pencil
} from 'lucide-react';

export function ProjectSwitcher() {
  const { t, language, direction } = useLanguage();
  const { 
    activeProjects, 
    currentProject, 
    switchProject,
    setIsNewProjectModalOpen,
    openProjectSettings
  } = useProject();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdown on click/touch outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Dynamic viewport edge containment: auto-clamp away from screen borders
  useEffect(() => {
    if (!isOpen) return;
    const adjustPosition = () => {
      if (!menuRef.current) return;
      menuRef.current.style.transform = 'none';
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 10;
      if (rect.right > window.innerWidth - padding) {
        const overflow = rect.right - (window.innerWidth - padding);
        menuRef.current.style.transform = `translateX(-${overflow}px)`;
      } else if (rect.left < padding) {
        const underflow = padding - rect.left;
        menuRef.current.style.transform = `translateX(${underflow}px)`;
      }
    };
    adjustPosition();
    const frameId = requestAnimationFrame(adjustPosition);
    window.addEventListener('resize', adjustPosition);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', adjustPosition);
    };
  }, [isOpen, direction, language]);

  const currencyBadgeColors = {
    IQD: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    IRT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    USD: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  };

  return (
    <div className="relative inline-block text-start" ref={dropdownRef}>
      {/* Trigger Button (Apple Liquid Glass) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-white/60 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl transition-all text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 group"
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

      {/* Floating Dropdown Menu (Apple Liquid Glass) */}
      {isOpen && (
        <div 
          ref={menuRef}
          className="absolute top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.25rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-3xl backdrop-saturate-200 border border-white/60 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.1)] py-2 z-50 animate-fade-in divide-y divide-slate-200/40 dark:divide-white/10 ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto"
        >
          
          {/* Header title */}
          <div className="px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
            <span>{t('projects') || 'پروژه‌ها و کارگاه‌ها'}</span>
            <span className="text-[10px] bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300 font-mono border border-white/40 dark:border-white/5">
              {activeProjects.length}
            </span>
          </div>

          {/* Project List */}
          <div className="py-1 max-h-56 overflow-y-auto">
            {activeProjects.map((p) => {
              const isSelected = p.id === currentProject?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    switchProject(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-start px-3.5 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-sky-500/15 dark:bg-sky-500/25 text-sky-700 dark:text-sky-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
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

                    {/* Quick Edit icon button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        if (openProjectSettings) openProjectSettings(p.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-white/80 dark:hover:bg-white/20 transition-colors"
                      title={language === 'fa' ? `ویرایش تنظیمات «${p.name}»` : 'Edit Project Settings'}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                  </div>
                </div>
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
              className="w-full text-start px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createNewProject') || 'ایجاد پروژه جدید'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (openProjectSettings) openProjectSettings(currentProject?.id);
              }}
              className="w-full text-start px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/[0.08] flex items-center gap-2 transition-colors"
            >
              <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>{language === 'fa' ? 'مدیریت و تنظیمات پروژه‌ها' : language === 'ku' ? 'بەڕێوەبردنی پڕۆژەکان' : 'Project Management'}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
