import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { SectionStatsModal } from './SectionStatsModal';
import { 
  FolderKanban, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Settings2, 
  Check,
  Building,
  Pencil,
  Search,
  Layers,
  BarChart2
} from 'lucide-react';

const PROJECT_SWITCHER_COPY = {
  fa: {
    selectProject: 'انتخاب پروژه',
    projectFallback: 'پروژه',
    projectsAndSections: 'پروژه‌ها و بخش‌ها',
    searchPlaceholder: 'جستجوی پروژه یا بخش...',
    noProjectFound: 'پروژه‌ای با این نام یا بخش یافت نشد',
    collapseSections: 'بستن شاخه‌ها',
    expandSections: 'مشاهده بخش‌های پروژه',
    sectionUnit: 'بخش',
    projectSettingsTitle: (name) => `تنظیمات «${name}»`,
    noSectionsAdd: '(بدون بخش - افزودن بخش +)',
    sectionStatsTitle: 'مشاهده تمام آمار و ارقام این بخش',
    stats: 'آمار و ارقام',
    addNewSection: 'افزودن بخش جدید...',
    createNewProject: 'ایجاد پروژه جدید',
    manageProjects: 'مدیریت و تنظیمات پروژه‌ها'
  },
  ku: {
    selectProject: 'هەڵبژاردنی پڕۆژە',
    projectFallback: 'پڕۆژە',
    projectsAndSections: 'پڕۆژە و بەشەکان',
    searchPlaceholder: 'گەڕان بۆ پڕۆژە یان بەش...',
    noProjectFound: 'هیچ پڕۆژەیەک بەم ناوە یان بەشە نەدۆزرایەوە',
    collapseSections: 'داخستنی لقەکان',
    expandSections: 'بینینی بەشەکانی پڕۆژە',
    sectionUnit: 'بەش',
    projectSettingsTitle: (name) => `ڕێکخستنەکانی «${name}»`,
    noSectionsAdd: '(بێ بەش - زیادکردنی بەش +)',
    sectionStatsTitle: 'بینینی تەواوی ئامارەکانی ئەم بەشە',
    stats: 'ئامارەکان',
    addNewSection: 'زیادکردنی بەشی نوێ...',
    createNewProject: 'دروستکردنی پڕۆژەی نوێ',
    manageProjects: 'بەڕێوەبردن و ڕێکخستنی پڕۆژەکان'
  },
  en: {
    selectProject: 'Select Project',
    projectFallback: 'Project',
    projectsAndSections: 'Projects & Sections',
    searchPlaceholder: 'Search project or section...',
    noProjectFound: 'No project or section found',
    collapseSections: 'Collapse Sections',
    expandSections: 'View Project Sections',
    sectionUnit: 'sections',
    projectSettingsTitle: (name) => `Settings for "${name}"`,
    noSectionsAdd: '(No sections - Add Section +)',
    sectionStatsTitle: 'View all statistics for this section',
    stats: 'Stats',
    addNewSection: '+ Add New Section...',
    createNewProject: 'Create New Project',
    manageProjects: 'Project Settings & Management'
  }
};

export function ProjectSwitcher() {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = PROJECT_SWITCHER_COPY[langKey] || PROJECT_SWITCHER_COPY.fa;

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionForStats, setSelectedSectionForStats] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});

  // Ensure current project's section tree is expanded by default
  useEffect(() => {
    if (currentProject?.id) {
      setExpandedProjects(prev => ({ ...prev, [currentProject.id]: true }));
    }
  }, [currentProject?.id]);

  // Live query all project sections from Dexie
  const allSections = useLiveQuery(async () => {
    try {
      return await db.projectSections.toArray();
    } catch {
      return [];
    }
  }, []) || [];

  const sectionsByProject = useMemo(() => {
    const map = {};
    allSections.forEach((s) => {
      if (s.deletedAt || s.status === 'archived') return;
      if (!map[s.projectId]) map[s.projectId] = [];
      map[s.projectId].push(s);
    });
    return map;
  }, [allSections]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return activeProjects;
    const q = searchQuery.toLowerCase().trim();
    return activeProjects.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCurrency = (p.currency || '').toLowerCase().includes(q);
      const matchSection = (sectionsByProject[p.id] || []).some((s) => (s.name || '').toLowerCase().includes(q));
      return matchName || matchCurrency || matchSection;
    });
  }, [activeProjects, searchQuery, sectionsByProject]);

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

  const toggleProjectTree = (projectId, e) => {
    if (e) e.stopPropagation();
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const currencyBadgeColors = {
    IQD: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    IRT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    USD: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  };

  return (
    <>
      <div className="relative inline-block text-start" ref={dropdownRef}>
        {/* Trigger Button (Compact Apple Liquid Glass Pill) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl sm:rounded-2xl bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-white/60 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl transition-all text-xs font-medium text-slate-800 dark:text-slate-100 group"
          title={currentProject?.name || c.selectProject}
        >
          <FolderKanban className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          
          <span className="font-bold max-w-[80px] sm:max-w-[110px] md:max-w-[130px] truncate text-xs leading-none">
            {currentProject?.name || c.projectFallback}
          </span>

          {currentProject?.currency && (
            <span className={`text-[9px] px-1 py-0.5 rounded-md font-mono font-bold leading-none border hidden xs:inline-block ${
              currencyBadgeColors[currentProject.currency] || currencyBadgeColors.IQD
            }`}>
              {currentProject.currency}
            </span>
          )}

          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </button>

        {/* Floating Dropdown Menu (Apple Liquid Glass) */}
        {isOpen && (
          <div 
            ref={menuRef}
            className="absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.25rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-3xl backdrop-saturate-200 border border-white/60 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.1)] py-2 z-50 animate-fade-in divide-y divide-slate-200/40 dark:divide-white/10 ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto"
          >
            {/* Header title */}
            <div className="px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
              <span>{c.projectsAndSections}</span>
              <span className="text-[10px] bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300 font-mono border border-white/40 dark:border-white/5">
                {activeProjects.length}
              </span>
            </div>

            {/* Quick Search if more than 1 project exists */}
            {activeProjects.length > 1 && (
              <div className="px-2.5 py-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={c.searchPlaceholder}
                    className="w-full ps-8 pe-3 py-1 bg-white/60 dark:bg-slate-800/60 rounded-xl text-xs border border-slate-200/80 dark:border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            )}

            {/* Project List with Tree Hierarchy of Sections */}
            <div className="py-1 max-h-72 overflow-y-auto space-y-1">
              {filteredProjects.length === 0 ? (
                <div className="px-3.5 py-3 text-center text-xs text-slate-400">
                  {c.noProjectFound}
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const isSelected = p.id === currentProject?.id;
                  const pSections = sectionsByProject[p.id] || [];
                  const isTreeExpanded = searchQuery.trim() !== '' || !!expandedProjects[p.id];

                  return (
                    <div key={p.id} className="border-b border-slate-100/60 dark:border-white/5 last:border-b-0 pb-1">
                      {/* Project Header Row */}
                      <div
                        onClick={() => {
                          switchProject(p.id);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-start px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer group rounded-xl ${
                          isSelected
                            ? 'bg-sky-500/15 dark:bg-sky-500/25 text-sky-800 dark:text-sky-200 font-bold'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Tree Toggle Chevron */}
                          <button
                            type="button"
                            onClick={(e) => toggleProjectTree(p.id, e)}
                            className="p-1 -ms-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
                            title={isTreeExpanded ? c.collapseSections : c.expandSections}
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isTreeExpanded ? '' : '-rotate-90'
                            }`} />
                          </button>

                          <Building className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'
                          }`} />

                          <div className="truncate flex items-center gap-1">
                            <span className="truncate">{p.name}</span>
                            {pSections.length > 0 && (
                              <span 
                                onClick={(e) => toggleProjectTree(p.id, e)}
                                className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100/70 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-mono font-medium hover:scale-105 transition-transform"
                              >
                                {pSections.length} {c.sectionUnit}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border ${
                            currencyBadgeColors[p.currency] || currencyBadgeColors.IQD
                          }`}>
                            {p.currency}
                          </span>

                          {/* Quick Edit settings icon button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              if (openProjectSettings) openProjectSettings(p.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-white/80 dark:hover:bg-white/20 transition-colors"
                            title={c.projectSettingsTitle(p.name)}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>

                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                        </div>
                      </div>

                      {/* Tree Diagram of Project Sections */}
                      {isTreeExpanded && (
                        <div className="ms-4 sm:ms-5 ps-3 py-1 space-y-1 relative border-s-2 border-slate-300/70 dark:border-slate-700/80 animate-in fade-in duration-150">
                          {pSections.length === 0 ? (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                if (openProjectSettings) openProjectSettings(p.id);
                              }}
                              className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer group"
                            >
                              <div className="absolute -start-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-slate-300/70 dark:bg-slate-700/80 group-hover:bg-sky-400 transition-colors" />
                              <Plus className="w-3 h-3" />
                              <span>{c.noSectionsAdd}</span>
                            </div>
                          ) : (
                            <>
                              {pSections.map((sec) => (
                                <div
                                  key={sec.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSectionForStats(sec);
                                  }}
                                  className="relative flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/50 text-xs text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 transition-all cursor-pointer group"
                                >
                                  {/* Horizontal Tree Branch Connector */}
                                  <div className="absolute -start-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-slate-300/70 dark:bg-slate-700/80 group-hover:bg-sky-400 dark:group-hover:bg-sky-500 transition-colors" />

                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-5 h-5 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                      <Layers className="w-3 h-3" />
                                    </div>
                                    <span className="font-medium truncate">{sec.name}</span>
                                  </div>

                                  {/* Stats Link Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSectionForStats(sec);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/90 dark:bg-slate-800 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200/90 dark:border-sky-800/90 shadow-2xs group-hover:bg-sky-500 group-hover:text-white dark:group-hover:bg-sky-500 dark:group-hover:text-white transition-all flex-shrink-0"
                                    title={c.sectionStatsTitle}
                                  >
                                    <BarChart2 className="w-3 h-3" />
                                    <span>{c.stats}</span>
                                  </button>
                                </div>
                              ))}

                              {/* Quick link to add another section under this project */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsOpen(false);
                                  if (openProjectSettings) openProjectSettings(p.id);
                                }}
                                className="relative flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors group"
                              >
                                <div className="absolute -start-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-slate-300/70 dark:bg-slate-700/80 group-hover:bg-sky-400 transition-colors" />
                                <Plus className="w-3 h-3" />
                                <span>{c.addNewSection}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
                <span>{c.createNewProject}</span>
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
                <span>{c.manageProjects}</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Comprehensive Section Statistics Modal */}
      {selectedSectionForStats && (
        <SectionStatsModal
          section={selectedSectionForStats}
          isOpen={!!selectedSectionForStats}
          onClose={() => setSelectedSectionForStats(null)}
          onSwitchProject={(pId, sId) => {
            switchProject(pId);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
