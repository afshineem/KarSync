import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { TaskFormModal } from './TaskFormModal';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Users,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  ListTodo,
  CheckSquare,
  Square,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Check,
  Columns3,
  List
} from 'lucide-react';

export function TasksModal({
  isOpen,
  onClose,
  tasks = [],
  isLoading = false,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onGoToGroupPerformance,
  targetProjectId = null
}) {
  const { language, direction } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [viewMode, setViewMode] = useState('board'); // 'board' (3 columns) | 'list'
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState(null);

  // Task to delete confirm state
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Keyboard shortcut listener: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (taskToDelete) {
          setTaskToDelete(null);
        } else if (isFormOpen) {
          setIsFormOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFormOpen, taskToDelete, onClose]);

  // Expand all parent tasks by default when modal is first opened
  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      setExpandedTaskIds(prev => {
        if (prev.size > 0) return prev; // Keep user's expanded state intact
        const parentIds = tasks.filter(t => !t.parent_id).map(t => t.id);
        return new Set(parentIds);
      });
    }
  }, [isOpen]);

  // Separate parent tasks and subtasks
  const { parentTasks, subtasksMap, uniqueGroups } = useMemo(() => {
    const parents = [];
    const subMap = {};
    const groupsSet = new Set();

    tasks.forEach(task => {
      if (task.group_name) groupsSet.add(task.group_name);
      if (task.parent_id) {
        if (!subMap[task.parent_id]) subMap[task.parent_id] = [];
        subMap[task.parent_id].push(task);
      } else {
        parents.push(task);
      }
    });

    return {
      parentTasks: parents,
      subtasksMap: subMap,
      uniqueGroups: Array.from(groupsSet)
    };
  }, [tasks]);

  // Filtered parent tasks
  const filteredTasks = useMemo(() => {
    return parentTasks.filter(task => {
      // Search matching either parent title/desc or any subtask title
      const childs = subtasksMap[task.id] || [];
      const matchSearch =
        !searchQuery.trim() ||
        task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.group_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        childs.some(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()));

      // Group filter
      const matchGroup =
        selectedGroupFilter === 'all' ||
        task.group_name === selectedGroupFilter ||
        childs.some(c => c.group_name === selectedGroupFilter);

      return matchSearch && matchGroup;
    });
  }, [parentTasks, subtasksMap, searchQuery, selectedGroupFilter]);

  // Categorize parent tasks by status
  const notStartedTasks = useMemo(
    () => filteredTasks.filter(t => t.status === 'not_started' || !t.status),
    [filteredTasks]
  );
  const inProgressTasks = useMemo(
    () => filteredTasks.filter(t => t.status === 'in_progress'),
    [filteredTasks]
  );
  const completedTasks = useMemo(
    () => filteredTasks.filter(t => t.status === 'completed'),
    [filteredTasks]
  );

  const toggleExpand = (taskId) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleOpenNewTask = () => {
    setTaskToEdit(null);
    setParentTaskForSubtask(null);
    setIsFormOpen(true);
  };

  const handleOpenNewSubtask = (parentTask) => {
    setTaskToEdit(null);
    setParentTaskForSubtask(parentTask);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task) => {
    setTaskToEdit(task);
    setParentTaskForSubtask(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (formData, taskId) => {
    if (taskId) {
      return await onUpdateTask(taskId, formData);
    } else {
      return await onAddTask(formData);
    }
  };

  const handleToggleStatus = async (task) => {
    let nextStatus = 'not_started';
    if (!task.status || task.status === 'not_started') {
      nextStatus = 'in_progress';
    } else if (task.status === 'in_progress') {
      nextStatus = 'completed';
    } else {
      nextStatus = 'not_started';
    }
    await onUpdateTask(task.id, { status: nextStatus });
  };

  const handleToggleSubtask = async (subtask) => {
    const nextStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
    await onUpdateTask(subtask.id, { status: nextStatus });
  };

  const handleGoToGroup = (groupName, groupId) => {
    if (onGoToGroupPerformance) {
      onClose();
      onGoToGroupPerformance(groupName, groupId);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] w-screen h-screen m-0 p-0 flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors animate-fadeIn overflow-hidden"
      style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
      dir={direction}
    >
      {/* ========================================================= */}
      {/* 1. HEADER (بخش هدر: ثبت تسک جدید، فیلترها و کلیدهای میانبر) */}
      {/* ========================================================= */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-8 py-3.5 sm:py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Right: Title & Stats */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 flex-shrink-0">
              <ListTodo className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {language === 'ku' ? 'بەڕێوەبردنی ئەرکەکانی پڕۆژە' : 'مدیریت و برنامه‌ریزی تسک‌ها'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                  {tasks.length} {language === 'ku' ? 'ئەرک' : 'مورد'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                {language === 'ku'
                  ? 'پلانی جێبەجێکردن، دابەشکردنی کارەکان و پێشکەوتنی تیمی کارگاه'
                  : 'برنامه‌ریزی اجرایی، تفکیک وظایف و کنترل پیشرفت فیزیکی کارگاه'}
              </p>
            </div>
          </div>

          {/* Center & Left Controls: Search, View Mode, New Task Button & Close */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ku' ? 'گەڕان لە ئەرکەکان...' : 'جستجو در تسک‌ها...'}
                className="w-full ps-9 pe-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Work Group Filter */}
            {uniqueGroups.length > 0 && (
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="all">{language === 'ku' ? 'هەموو گرووپەکان' : 'همه گروه‌ها'}</option>
                {uniqueGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            {/* View Mode Toggle: Board vs List */}
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                title="نمایش ستونی (Board)"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'board'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <Columns3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="نمایش لیستی (List)"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* NEW TASK BUTTON (دکمه ثبت تسک جدید) */}
            <button
              type="button"
              onClick={handleOpenNewTask}
              className="flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{language === 'ku' ? 'ئەرکی نوێ' : 'تسک جدید'}</span>
            </button>

            {/* Close Modal Button (X) */}
            <div className="flex items-center gap-1.5 ms-1">
              <span className="hidden xl:inline-block text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                Esc
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 sm:p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="بستن (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

          </div>
        </div>

        {/* Quick Shortcut Hint Bar */}
        <div className="hidden sm:flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              {language === 'ku' ? 'دەستپێنەکراو:' : 'شروع نشده:'} <strong className="text-slate-700 dark:text-slate-300 font-mono">{notStartedTasks.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
              {language === 'ku' ? 'لە جێبەجێکردندا:' : 'در حال انجام:'} <strong className="text-sky-600 dark:text-sky-400 font-mono">{inProgressTasks.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {language === 'ku' ? 'تەواوکراو:' : 'پایان یافته:'} <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{completedTasks.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>میانبر باز کردن:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">Shift + T</kbd>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BODY (بدنه: لیست تسک‌ها و سابتسک‌ها با تفکیک بصری وضعیت‌ها) */}
      {/* ========================================================= */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-20">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-bold">در حال بارگذاری تسک‌ها...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="max-w-md mx-auto my-16 text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ListTodo className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {language === 'ku' ? 'هیچ ئەرکێک نەدۆزرایەوە' : 'تسکی برای نمایش وجود ندارد'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {searchQuery || selectedGroupFilter !== 'all'
                  ? 'با فیلترهای انتخاب شده هیچ موردی یافت نشد.'
                  : 'برای شروع برنامه‌ریزی کارگاه، اولین تسک پروژه را ثبت کنید.'}
              </p>
            </div>
            <button
              onClick={handleOpenNewTask}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ku' ? 'تۆمارکردنی یەکەم ئەرک' : 'ثبت اولین تسک'}</span>
            </button>
          </div>
        ) : viewMode === 'board' ? (
          
          /* ---------------------------------------------------- */
          /* BOARD VIEW: 3 DISTINCT COLUMNS (تفکیک بصری ۳ وضعیت) */
          /* ---------------------------------------------------- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start max-w-7xl mx-auto">
            
            {/* Column 1: شروع نشده (Not Started) */}
            <TaskColumn
              title={language === 'ku' ? 'دەستپێنەکراو' : 'شروع نشده'}
              count={notStartedTasks.length}
              tasks={notStartedTasks}
              subtasksMap={subtasksMap}
              expandedTaskIds={expandedTaskIds}
              onToggleExpand={toggleExpand}
              onToggleStatus={handleToggleStatus}
              onToggleSubtask={handleToggleSubtask}
              onOpenEdit={handleOpenEdit}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onAddSubtask={handleOpenNewSubtask}
              onGoToGroup={handleGoToGroup}
              themeVariant="neutral"
              language={language}
              direction={direction}
            />

            {/* Column 2: در حال انجام (In Progress) */}
            <TaskColumn
              title={language === 'ku' ? 'لە جێبەجێکردندا' : 'در حال انجام'}
              count={inProgressTasks.length}
              tasks={inProgressTasks}
              subtasksMap={subtasksMap}
              expandedTaskIds={expandedTaskIds}
              onToggleExpand={toggleExpand}
              onToggleStatus={handleToggleStatus}
              onToggleSubtask={handleToggleSubtask}
              onOpenEdit={handleOpenEdit}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onAddSubtask={handleOpenNewSubtask}
              onGoToGroup={handleGoToGroup}
              themeVariant="primary"
              language={language}
              direction={direction}
            />

            {/* Column 3: پایان یافته (Completed) */}
            <TaskColumn
              title={language === 'ku' ? 'تەواوکراو' : 'پایان یافته'}
              count={completedTasks.length}
              tasks={completedTasks}
              subtasksMap={subtasksMap}
              expandedTaskIds={expandedTaskIds}
              onToggleExpand={toggleExpand}
              onToggleStatus={handleToggleStatus}
              onToggleSubtask={handleToggleSubtask}
              onOpenEdit={handleOpenEdit}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onAddSubtask={handleOpenNewSubtask}
              onGoToGroup={handleGoToGroup}
              themeVariant="success"
              language={language}
              direction={direction}
            />

          </div>

        ) : (

          /* ---------------------------------------------------- */
          /* LIST VIEW: UNIFIED LIST WITH COLLAPSIBLE SECTIONS   */
          /* ---------------------------------------------------- */
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                subtasks={subtasksMap[task.id] || []}
                isExpanded={expandedTaskIds.has(task.id)}
                onToggleExpand={() => toggleExpand(task.id)}
                onToggleStatus={() => handleToggleStatus(task)}
                onToggleSubtask={handleToggleSubtask}
                onOpenEdit={() => handleOpenEdit(task)}
                onDeleteTask={() => setTaskToDelete(task)}
                onAddSubtask={() => handleOpenNewSubtask(task)}
                onGoToGroup={handleGoToGroup}
                language={language}
                direction={direction}
              />
            ))}
          </div>

        )}

      </main>

      {/* ========================================================= */}
      {/* 3. DEDICATED MODALS: Create/Edit Form & Delete Confirm   */}
      {/* ========================================================= */}
      {isFormOpen && (
        <TaskFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          taskToEdit={taskToEdit}
          parentTask={parentTaskForSubtask}
          targetProjectId={targetProjectId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {taskToDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setTaskToDelete(null)}
          dir={direction}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'سڕینەوەی ئەرک' : 'حذف تسک'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                آیا از حذف تسک «<strong className="text-slate-800 dark:text-slate-200">{taskToDelete.title}</strong>» و سابتسک‌های تابعه اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = taskToDelete.id;
                  setTaskToDelete(null);
                  await onDeleteTask(id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-colors"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return createPortal(modalContent, document.body);
}

// =========================================================
// SUB-COMPONENT: Column Container for Board View
// =========================================================
function TaskColumn({
  title,
  count,
  tasks,
  subtasksMap,
  expandedTaskIds,
  onToggleExpand,
  onToggleStatus,
  onToggleSubtask,
  onOpenEdit,
  onDeleteTask,
  onAddSubtask,
  onGoToGroup,
  themeVariant = 'neutral',
  language,
  direction
}) {
  const variantStyles = {
    neutral: {
      headerBg: 'bg-slate-100 dark:bg-slate-850',
      badgeBg: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-800',
      dotColor: 'bg-slate-400'
    },
    primary: {
      headerBg: 'bg-sky-50 dark:bg-sky-950/40',
      badgeBg: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-900/40',
      dotColor: 'bg-sky-500 animate-pulse'
    },
    success: {
      headerBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-900/40',
      dotColor: 'bg-emerald-500'
    }
  };

  const style = variantStyles[themeVariant];

  return (
    <div className={`rounded-3xl border ${style.border} bg-white/70 dark:bg-slate-900/75 backdrop-blur-md overflow-hidden flex flex-col shadow-sm`}>
      {/* Column Header */}
      <div className={`px-4.5 py-3.5 flex items-center justify-between border-b ${style.border} ${style.headerBg}`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${style.dotColor}`}></span>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${style.badgeBg}`}>
          {count}
        </span>
      </div>

      {/* Column Tasks List */}
      <div className="p-3.5 space-y-3 min-h-[350px] max-h-[calc(100vh-250px)] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 text-xs text-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl">
            <span>هیچ تسکی در این وضعیت نیست</span>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              subtasks={subtasksMap[task.id] || []}
              isExpanded={expandedTaskIds.has(task.id)}
              onToggleExpand={() => onToggleExpand(task.id)}
              onToggleStatus={() => onToggleStatus(task)}
              onToggleSubtask={onToggleSubtask}
              onOpenEdit={() => onOpenEdit(task)}
              onDeleteTask={() => onDeleteTask(task)}
              onAddSubtask={() => onAddSubtask(task)}
              onGoToGroup={onGoToGroup}
              language={language}
              direction={direction}
            />
          ))
        )}
      </div>
    </div>
  );
}

// =========================================================
// SUB-COMPONENT: Individual Task Card with Subtasks
// =========================================================
function TaskCard({
  task,
  subtasks = [],
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onToggleSubtask,
  onOpenEdit,
  onDeleteTask,
  onAddSubtask,
  onGoToGroup,
  language,
  direction
}) {
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';

  // Completed subtasks count
  const completedSubsCount = subtasks.filter(s => s.status === 'completed').length;
  const progressPercent = subtasks.length > 0 ? Math.round((completedSubsCount / subtasks.length) * 100) : 0;

  return (
    <div
      className={`rounded-2xl border transition-all p-4 flex flex-col justify-between group ${
        isCompleted
          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/30'
          : isInProgress
          ? 'bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/80 dark:border-sky-900/40 shadow-sm'
          : 'bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-600/50'
      }`}
    >
      <div>
        {/* Top Meta: Status Checkbox, Title & Actions */}
        <div className="flex items-start justify-between gap-2.5">
          
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Quick Status Toggle Button */}
            <button
              type="button"
              onClick={onToggleStatus}
              title={
                isCompleted
                  ? 'تغییر به شروع‌نشده'
                  : isInProgress
                  ? 'علامت‌گذاری به عنوان پایان یافته'
                  : 'علامت‌گذاری به عنوان در حال انجام'
              }
              className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                isCompleted
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : isInProgress
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950 text-sky-500 hover:bg-sky-500 hover:text-white'
                  : 'border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-transparent'
              }`}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : isInProgress ? (
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              ) : (
                <Check className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100" />
              )}
            </button>

            {/* Task Title */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onOpenEdit(task)}
              title="مشاهده و ویرایش جزییات تسک"
            >
              <h4 className={`text-sm font-bold leading-snug break-words group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                isCompleted
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {task.title}
              </h4>

              {/* Description preview */}
              {task.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons (Edit & Delete) */}
          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onOpenEdit}
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
              title="ویرایش"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDeleteTask}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Badges Bar: Group, Priority, Hours, Dates */}
        <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          
          {/* Work Group Badge */}
          {task.group_name && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onGoToGroup) {
                  onGoToGroup(task.group_name, task.group_id);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              title={language === 'ku' ? 'چوون بۆ کارکردی ئەم گرووپە' : 'مشاهده کارکرد و گزارش این گروه'}
            >
              <Users className="w-3 h-3 text-indigo-500" />
              <span>{task.group_name}</span>
            </button>
          )}

          {/* Priority Badge */}
          {task.priority === 'high' && (
            <span className="px-2 py-0.5 rounded-md font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
              فوری
            </span>
          )}
          {task.priority === 'medium' && (
            <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              متوسط
            </span>
          )}
          {task.priority === 'low' && (
            <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              کم
            </span>
          )}

          {/* Estimated Hours */}
          {task.estimated_hours > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
              <Clock className="w-3 h-3 text-sky-500" />
              <span>{task.estimated_hours} ساعت</span>
            </span>
          )}

          {/* Due Date */}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
              <Calendar className="w-3 h-3 text-amber-500" />
              <span>{task.due_date}</span>
            </span>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBTASKS SECTION (سابتسک‌ها و فهرست وظایف فرعی)           */}
      {/* ========================================================= */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
        
        {/* Subtasks Accordion Header & Add Subtask Button */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            )}
            <span>سابتسک‌ها</span>
            {subtasks.length > 0 && (
              <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {completedSubsCount}/{subtasks.length}
              </span>
            )}
          </button>

          {/* "+ افزودن سابتسک" */}
          <button
            type="button"
            onClick={onAddSubtask}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>افزودن سابتسک</span>
          </button>
        </div>

        {/* Subtask Progress Bar if has subtasks */}
        {subtasks.length > 0 && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        )}

        {/* Subtasks List */}
        {isExpanded && subtasks.length > 0 && (
          <div className="mt-2.5 space-y-1.5 ps-1">
            {subtasks.map(sub => {
              const subCompleted = sub.status === 'completed';
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-700/50 group/sub transition-colors text-xs"
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subCompleted}
                      onChange={() => onToggleSubtask(sub)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={`truncate text-xs ${
                      subCompleted
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}>
                      {sub.title}
                    </span>
                  </label>

                  {/* Subtask micro badges */}
                  <div className="flex items-center gap-1 opacity-70 group-hover/sub:opacity-100">
                    {sub.estimated_hours > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {sub.estimated_hours}h
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenEdit(sub)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(sub)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
