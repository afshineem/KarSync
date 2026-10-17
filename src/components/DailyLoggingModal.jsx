import { logAuditAction, getSafeAuthContext } from "../services/auditLogger";
import { pushLogsLive } from '../services/realtimeSync';
import { emitToast } from '../context/NotificationContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAttendanceLogId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { 
  formatCurrency, 
  formatAmount,
  getTodayDateString, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes, 
  roundCurrency,
  getCurrencySymbol 
} from '../utils/formatters';
import { EditRecordModal } from './EditRecordModal';
import { 
  Plus, 
  CalendarPlus,
  Calendar, 
  Clock, 
  FileText, 
  AlertTriangle, 
  Check, 
  X, 
  UserCheck, 
  Coins,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Edit2,
  Users,
  ShieldAlert,
  Layers,
  Receipt,
  CreditCard,
  User,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  CornerDownLeft,
  ArrowLeftRight
} from 'lucide-react';

export function DailyLoggingModal({ isOpen, onClose, initialDate }) {
  const { t, language } = useLanguage();
  const { currentProject, openWorkerProfile } = useProject();
  const { user } = useAuth();
  const { currentUser } = usePermissions();
  const { canModifyDate } = usePermissions();
  const currency = currentProject?.currency || 'IQD';
  const standardHours = currentProject?.standardWorkHours || 8;

  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayDateString());
  const [selectedWorkers, setSelectedWorkers] = useState({});
  const [workerConfigs, setWorkerConfigs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingLog, setEditingLog] = useState(null);

  const [entryMode, setEntryMode] = useState('individual'); // 'individual' | 'group'
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isAlreadyLoggedExpanded, setIsAlreadyLoggedExpanded] = useState(false);
  const [groupConfig, setGroupConfig] = useState({
    type: 'full',
    overtimeHours: 0,
    notes: '',
    sectionId: '__default__'
  });

  // Date Shift Helper (Yesterday, Tomorrow, Today)
  const handleShiftDate = (days) => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d + days);
      const newY = dt.getFullYear();
      const newM = String(dt.getMonth() + 1).padStart(2, '0');
      const newD = String(dt.getDate()).padStart(2, '0');
      setSelectedDate(`${newY}-${newM}-${newD}`);
    } catch (_) {}
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Fetch project sections for current project
  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  const groups = useLiveQuery(
    async () => {
      try {
        const [allDbGroups, allDbWorkers] = await Promise.all([
          db.groups.toArray(),
          db.workers.toArray()
        ]);
        const projectWorkerGroupIds = new Set(
          allDbWorkers
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && w.groupId)
            .map((w) => String(w.groupId))
        );
        let list = allDbGroups.filter((g) => 
          !targetProjectId || 
          !g.projectId || 
          String(g.projectId) === String(targetProjectId) ||
          (g.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
          projectWorkerGroupIds.has(String(g.id))
        );
        if (list.length === 0 && allDbGroups.length > 0) {
          list = allDbGroups;
        }
        return list;
      } catch (err) {
        console.error('Error fetching groups in DailyLoggingModal:', err);
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  const [defaultSectionId, setDefaultSectionId] = useState('');

  const handleDefaultSectionChange = (newSecId) => {
    setDefaultSectionId(newSecId);
    setWorkerConfigs((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], sectionId: newSecId || null };
      });
      return updated;
    });
  };

  // Fetch active workers for current project with fallback for legacy records (exclude archived and deleted)
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => 
        (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && 
        w.isActive === 1 && 
        !w.deletedAt && 
        !w.isArchived && 
        w.status !== 'archived'
      );
    },
    [targetProjectId]
  ) || [];

  // Fetch existing logs for the selected date to detect pre-existing logs
  const existingDateLogs = useLiveQuery(
    async () => {
      const list = await db.attendanceLogs.toArray();
      return list.filter((l) => (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId && l.date === selectedDate);
    },
    [targetProjectId, selectedDate]
  ) || [];

  const existingWorkerLogMap = useMemo(() => {
    const map = {};
    existingDateLogs.forEach((l) => {
      map[l.workerId] = l;
    });
    return map;
  }, [existingDateLogs]);

  // Separate workers into available to log vs already logged
  const { unloggedWorkers, alreadyLoggedWorkers } = useMemo(() => {
    const unlogged = [];
    const alreadyLogged = [];
    workers.forEach((w) => {
      const log = existingWorkerLogMap[w.id];
      if (log) {
        alreadyLogged.push({ worker: w, log });
      } else {
        unlogged.push(w);
      }
    });
    return { unloggedWorkers: unlogged, alreadyLoggedWorkers: alreadyLogged };
  }, [workers, existingWorkerLogMap]);

  // Track open state and date changes to avoid wiping worker edits during live queries
  const prevIsOpenRef = useRef(false);
  const prevSelectedDateRef = useRef(selectedDate);

  // When date changes or modal opens, initialize selections for UNLOGGED workers only
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const isNewlyOpened = !prevIsOpenRef.current;
    const isDateChanged = prevSelectedDateRef.current !== selectedDate;

    if (isNewlyOpened && initialDate) {
      setSelectedDate(initialDate);
    }

    if (isNewlyOpened || isDateChanged) {
      prevIsOpenRef.current = true;
      prevSelectedDateRef.current = selectedDate;

      const initialSelected = {};
      const initialConfigs = {};

      let absentSet = new Set();
      try {
        const raw = localStorage.getItem('karsync_daily_absent_workers_v1');
        const map = raw ? JSON.parse(raw) : {};
        absentSet = new Set((map[`${targetProjectId}_${selectedDate}`] || []).map(String));
      } catch {
        // ignore
      }

      unloggedWorkers.forEach((w) => {
        // If this worker was already unchecked (marked absent) or today's shift already has logged workers, default to unchecked
        initialSelected[w.id] = absentSet.has(String(w.id)) || existingDateLogs.length > 0 ? false : true;
        initialConfigs[w.id] = {
          type: 'full',
          overtimeHours: 0,
          notes: '',
          sectionId: w.defaultSectionId || null
        };
      });

      setSelectedWorkers(initialSelected);
      setWorkerConfigs(initialConfigs);
      setGroupConfig({
        type: 'full',
        overtimeHours: 0,
        notes: '',
        sectionId: '__default__'
      });
    } else {
      // Modal is already open and date has not changed:
      // Merge only newly appeared unlogged workers without wiping existing configs or sections!
      setWorkerConfigs((prev) => {
        let hasChanges = false;
        const updated = { ...prev };
        unloggedWorkers.forEach((w) => {
          if (!updated[w.id]) {
            hasChanges = true;
            updated[w.id] = {
              type: 'full',
              overtimeHours: 0,
              notes: '',
              sectionId: w.defaultSectionId || null
            };
          }
        });
        return hasChanges ? updated : prev;
      });

      setSelectedWorkers((prev) => {
        let hasChanges = false;
        const updated = { ...prev };
        unloggedWorkers.forEach((w) => {
          if (updated[w.id] === undefined) {
            hasChanges = true;
            updated[w.id] = existingDateLogs.length > 0 ? false : true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }
  }, [isOpen, selectedDate, unloggedWorkers, existingDateLogs.length, targetProjectId, initialDate]);

  // Section filter within logging modal
  const [filterModalSection, setFilterModalSection] = useState('all');

  const filteredUnloggedWorkers = useMemo(() => {
    if (filterModalSection === 'all') return unloggedWorkers;
    return unloggedWorkers.filter((w) => {
      const assignedSec = workerConfigs[w.id]?.sectionId ?? w.defaultSectionId;
      if (filterModalSection === 'unassigned') return !assignedSec;
      return assignedSec === filterModalSection;
    });
  }, [unloggedWorkers, filterModalSection, workerConfigs]);

  // Bulk move selected workers to section today
  const handleBulkAssignSection = (targetSecId) => {
    const chosenSecId = targetSecId || '';
    setDefaultSectionId(chosenSecId);

    // Keep groupConfig synchronized so group mode uses this selected section
    setGroupConfig((prev) => ({
      ...prev,
      sectionId: chosenSecId
    }));

    // Update workerConfigs for selected workers (or current group members if in group mode)
    setWorkerConfigs((prev) => {
      const updated = { ...prev };
      const workerIdsToUpdate = entryMode === 'group' && selectedGroupId
        ? unloggedWorkers.filter(w => String(w.groupId) === String(selectedGroupId)).map(w => w.id)
        : Object.keys(selectedWorkers).filter((id) => selectedWorkers[id]);

      workerIdsToUpdate.forEach((id) => {
        updated[id] = { ...updated[id], sectionId: targetSecId || null };
      });
      return updated;
    });
  };

  // Handle worker checkbox toggle
  const toggleWorkerSelection = (workerId) => {
    // If worker is already logged, do not allow toggling on
    if (existingWorkerLogMap[workerId]) return;

    setSelectedWorkers((prev) => ({
      ...prev,
      [workerId]: !prev[workerId]
    }));
  };

  // Select all / Deselect all for unlogged workers
  const handleSelectAll = () => {
    const all = {};
    unloggedWorkers.forEach((w) => {
      all[w.id] = true;
    });
    setSelectedWorkers(all);
  };

  const handleDeselectAll = () => {
    const none = {};
    unloggedWorkers.forEach((w) => {
      none[w.id] = false;
    });
    setSelectedWorkers(none);
  };

  // Update granular config per worker
  const updateWorkerConfig = (workerId, field, value) => {
    setWorkerConfigs((prev) => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || { type: 'full', overtimeHours: 0, notes: '' }),
        [field]: value
      }
    }));
  };

  // Calculate day wage preview for a worker
  const calculateWorkerDayPay = (worker) => {
    const cfg = workerConfigs[worker.id] || { type: 'full', overtimeHours: 0 };
    const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
    const hourlyRate = worker.overtimeHourlyRate > 0 
      ? worker.overtimeHourlyRate 
      : Math.round((worker.dailyRate || 0) / standardHours);

    let basePay = 0;
    let otPay = 0;

    if (cfg.type === 'absent') {
      basePay = 0;
      otPay = 0;
    } else if (cfg.type === 'hourly') {
      basePay = 0;
      otPay = roundCurrency(otHours * hourlyRate, currency);
    } else {
      const baseFactor = cfg.type === 'half' ? 0.5 : 1.0;
      basePay = roundCurrency((worker.dailyRate || 0) * baseFactor, currency);
      otPay = roundCurrency(otHours * (worker.overtimeHourlyRate || 0), currency);
    }

    return {
      basePay,
      otPay,
      total: roundCurrency(basePay + otPay, currency)
    };
  };

  // Stepper handlers for hours & minutes
  const handleHoursChange = (workerId, val) => {
    const h = Math.max(0, Math.min(24, parseInt(val, 10) || 0));
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { minutes } = fromDecimalHours(currentOt);
    const newDecimal = toDecimalHours(h, minutes);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  const handleMinutesChange = (workerId, val) => {
    const m = Math.max(0, Math.min(59, parseInt(val, 10) || 0));
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { hours } = fromDecimalHours(currentOt);
    const newDecimal = toDecimalHours(hours, m);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  const addTime = (workerId, deltaMinutes) => {
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { hours, minutes } = fromDecimalHours(currentOt);
    let totalMinutes = hours * 60 + minutes + deltaMinutes;
    if (totalMinutes < 0) totalMinutes = 0;
    const newHours = Math.min(24, Math.floor(totalMinutes / 60));
    const newMinutes = newHours >= 24 ? 0 : totalMinutes % 60;
    const newDecimal = toDecimalHours(newHours, newMinutes);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  // Batch Save to IndexedDB
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    let checkedWorkerIds = [];

    if (entryMode === 'group') {
      if (!selectedGroupId) {
        emitToast({
          type: 'warning',
          title: 'انتخاب گروه الزامی است',
          message: 'لطفاً ابتدا یک گروه کاری را برای ثبت کارکرد انتخاب کنید.'
        });
        return;
      }
      checkedWorkerIds = unloggedWorkers.filter(w => w.groupId === selectedGroupId).map(w => w.id);
      if (checkedWorkerIds.length === 0) {
        emitToast({
          type: 'warning',
          title: 'عدم وجود پرسنل قابل ثبت',
          message: 'تمام پرسنل این گروه قبلاً در این تاریخ ثبت شده‌اند یا پرسنلی در گروه وجود ندارد.'
        });
        return;
      }
    } else {
      checkedWorkerIds = Object.keys(selectedWorkers).filter(
        (id) => selectedWorkers[id]
      );
    }

    // Identify unchecked workers in individual mode as absent for this date
    const uncheckedAbsentIds =
      entryMode !== 'group'
        ? filteredUnloggedWorkers
            .filter((w) => !selectedWorkers[w.id])
            .map((w) => String(w.id))
        : [];

    if (checkedWorkerIds.length === 0) {
      if (entryMode !== 'group' && uncheckedAbsentIds.length > 0) {
        try {
          const storageKey = 'karsync_daily_absent_workers_v1';
          const raw = localStorage.getItem(storageKey);
          const map = raw ? JSON.parse(raw) : {};
          const dayKey = `${targetProjectId}_${selectedDate}`;
          const prevAbsent = new Set((map[dayKey] || []).map(String));
          uncheckedAbsentIds.forEach((id) => prevAbsent.add(String(id)));
          map[dayKey] = Array.from(prevAbsent);
          localStorage.setItem(storageKey, JSON.stringify(map));
          window.dispatchEvent(new CustomEvent('karsync-daily-attendance-updated'));
        } catch {
          // ignore storage errors
        }
        emitToast({
          type: 'success',
          title: language === 'fa' ? 'ثبت غیبت روزانه انجام شد' : 'غیاب تۆمار کرا',
          message:
            language === 'fa'
              ? `غیبت ${uncheckedAbsentIds.length} نفر برای تاریخ ${selectedDate} ثبت شد.`
              : `غیابی ${uncheckedAbsentIds.length} کەس تۆمار کرا.`
        });
        onClose();
        return;
      }

      emitToast({
        type: 'warning',
        title: 'پرسنلی انتخاب نشده است',
        message: t('noWorkerSelectedError')
      });
      return;
    }

    // Safety guard: Ensure no already logged worker is submitted again
    const duplicates = checkedWorkerIds.filter((id) => existingWorkerLogMap[id]);
    if (duplicates.length > 0) {
      const names = duplicates.map((id) => workers.find((w) => w.id === id)?.name || id).join(', ');
      emitToast({
        type: 'error',
        title: 'رکورد تکراری',
        message: t('workerAlreadyLoggedError', { name: names })
      });
      return;
    }

    setIsSaving(true);
    try {
      const savedLogs = [];
      await db.transaction('rw', db.attendanceLogs, async () => {
        for (const workerId of checkedWorkerIds) {
          const worker = workers.find((w) => w.id === workerId);
          if (!worker) continue;

          let chosenSectionId;
          if (entryMode === 'group') {
            if (groupConfig.sectionId === '__default__') {
              chosenSectionId = worker.defaultSectionId || null;
            } else if (groupConfig.sectionId === '' || groupConfig.sectionId === null) {
              chosenSectionId = null;
            } else {
              chosenSectionId = groupConfig.sectionId;
            }
          } else {
            const wCfg = workerConfigs[workerId];
            chosenSectionId = wCfg?.sectionId !== undefined ? wCfg.sectionId : (worker.defaultSectionId || null);
          }

          const cfg = entryMode === 'group' 
            ? { ...groupConfig, sectionId: chosenSectionId }
            : workerConfigs[workerId] || { type: 'full', overtimeHours: 0, notes: '', sectionId: chosenSectionId };
          const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
          const wDaily = Number(String(worker.dailyRate).replace(/,/g, '')) || 0;
          const wOtRate = Number(String(worker.overtimeHourlyRate).replace(/,/g, '')) || 0;
          const hourlyRate = wOtRate > 0 
            ? wOtRate 
            : Math.round(wDaily / standardHours);

          let calculatedDailyWage = 0;
          let calculatedOvertimeWage = 0;

          if (cfg.type === 'absent') {
            calculatedDailyWage = 0;
            calculatedOvertimeWage = 0;
          } else if (cfg.type === 'hourly') {
            calculatedDailyWage = 0;
            calculatedOvertimeWage = roundCurrency(otHours * hourlyRate, currency);
          } else {
            const baseFactor = cfg.type === 'half' ? 0.5 : 1.0;
            calculatedDailyWage = roundCurrency(wDaily * baseFactor, currency);
            calculatedOvertimeWage = roundCurrency(otHours * wOtRate, currency);
          }
          const totalDayPay = roundCurrency(calculatedDailyWage + calculatedOvertimeWage, currency);

          // Deterministic unique ID per worker per date
          const canonicalId = getAttendanceLogId(String(workerId), selectedDate);
          const existingLog = await db.attendanceLogs.get(canonicalId);
          const newRecord = {
            id: canonicalId,
            workerId: String(workerId),
            projectId: worker.projectId || currentProject?.id || DEFAULT_PROJECT_ID,
            userId: user?.id || null,
            sectionId: chosenSectionId || null,
            date: selectedDate,
            type: cfg.type,
            overtimeHours: otHours,
            calculatedDailyWage,
            calculatedOvertimeWage,
            totalDayPay,
            notes: cfg.notes ? cfg.notes.trim() : '',
            isSettled: existingLog ? Boolean(existingLog.isSettled) : false,
            settlementReceiptId: existingLog?.settlementReceiptId || null,
            createdAt: existingLog?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            created_by_user_id: existingLog?.created_by_user_id || user?.id,
            updated_by_user_id: user?.id
          };

          await db.attendanceLogs.put(newRecord);
          savedLogs.push({ newRecord, existingLog, workerName: worker.name, type: cfg.type });
        }
      });

      // Execute Audit logs outside Dexie transaction to prevent "Transaction committed too early"
      const safeAuth = await getSafeAuthContext();
      for (const logInfo of savedLogs) {
        const { newRecord, existingLog, workerName, type } = logInfo;
        await logAuditAction({
          silentToast: true,
          workspaceId: safeAuth.workspaceId,
          userId: safeAuth.userId,
          userName: safeAuth.userName,
          actionType: existingLog ? 'EDIT_ATTENDANCE' : 'CREATE_ATTENDANCE',
          entityType: 'attendanceLogs',
          entityId: newRecord.id,
          projectId: newRecord.projectId,
          details: {
            description: existingLog 
              ? `ویرایش کارکرد ${workerName} در تاریخ ${selectedDate}` 
              : `ثبت کارکرد ${workerName} در تاریخ ${selectedDate}`,
            worker_name: workerName,
            date: selectedDate,
            type: type
          }
        }).catch(err => console.warn('Audit error:', err));
      }

      const logsToPush = savedLogs.map(info => info.newRecord);
      
      // Realtime push to Supabase
      if (logsToPush.length > 0) {
        pushLogsLive(logsToPush).catch((err) => console.warn('Supabase live push warning:', err));
      }

      // Persist unchecked workers as absent for this date so the system knows their status is accounted for
      try {
        const storageKey = 'karsync_daily_absent_workers_v1';
        const raw = localStorage.getItem(storageKey);
        const map = raw ? JSON.parse(raw) : {};
        const dayKey = `${targetProjectId}_${selectedDate}`;
        const prevAbsent = new Set((map[dayKey] || []).map(String));
        checkedWorkerIds.forEach((id) => prevAbsent.delete(String(id)));
        uncheckedAbsentIds.forEach((id) => prevAbsent.add(String(id)));
        map[dayKey] = Array.from(prevAbsent);
        localStorage.setItem(storageKey, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent('karsync-daily-attendance-updated'));
      } catch {
        // ignore storage errors
      }

      const successMsg = t('batchSavedSuccess', { count: checkedWorkerIds.length });
      emitToast({
        type: 'success',
        title: language === 'fa' ? 'ثبت کارکرد روزانه انجام شد' : 'کارکرد بە سەرکەوتوویی تۆمارکرا',
        message: successMsg
      });

      setToastMessage(successMsg);
      setTimeout(() => {
        setToastMessage('');
        onClose();
      }, 650);

    } catch (err) {
      console.error('Error saving batch attendance:', err);
      emitToast({
        type: 'error',
        title: language === 'fa' ? 'خطا در ثبت کارکرد' : 'هەڵە لە تۆمارکردنی کارکرد',
        message: err.message || 'خطای غیرمنتظره‌ای رخ داد.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = Object.keys(selectedWorkers).filter(id => selectedWorkers[id]).length;

  // Real-time batch calculation of wages and overtime for selected workers
  const summaryTotals = useMemo(() => {
    let totalGrossPay = 0;
    let totalOtHours = 0;
    let fullCount = 0;
    let halfCount = 0;
    let hourlyCount = 0;

    if (entryMode === 'group') {
      const groupWorkers = unloggedWorkers.filter(w => w.groupId === selectedGroupId);
      groupWorkers.forEach((w) => {
        const pay = calculateWorkerDayPay(w);
        totalGrossPay += pay.total;
        totalOtHours += Number(groupConfig.overtimeHours) || 0;
        if (groupConfig.type === 'full') fullCount++;
        else if (groupConfig.type === 'half') halfCount++;
        else if (groupConfig.type === 'hourly') hourlyCount++;
      });
      return {
        count: groupWorkers.length,
        totalGrossPay: roundCurrency(totalGrossPay, currency),
        totalOtHours,
        fullCount,
        halfCount,
        hourlyCount
      };
    }

    unloggedWorkers.forEach((w) => {
      if (selectedWorkers[w.id]) {
        const pay = calculateWorkerDayPay(w);
        const cfg = workerConfigs[w.id] || { type: 'full', overtimeHours: 0 };
        totalGrossPay += pay.total;
        totalOtHours += Number(cfg.overtimeHours) || 0;
        if (cfg.type === 'full') fullCount++;
        else if (cfg.type === 'half') halfCount++;
        else if (cfg.type === 'hourly') hourlyCount++;
      }
    });

    return {
      count: selectedCount,
      totalGrossPay: roundCurrency(totalGrossPay, currency),
      totalOtHours,
      fullCount,
      halfCount,
      hourlyCount
    };
  }, [entryMode, selectedGroupId, unloggedWorkers, groupConfig, selectedWorkers, workerConfigs, currency]);

  if (!isOpen) return null;

  const isRtl = language === 'fa' || language === 'ku';

  const modalContent = (
    <div 
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden select-none"
    >
      {/* 1. TOP EXECUTIVE HEADER */}
      <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Title & Icon Badge */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
                <CalendarPlus className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>{t('logDailyAttendance')}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                    {unloggedWorkers.length} {t('readyToLog') || 'آماده ثبت'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t('workerSelectionNotice')} ({selectedCount} از {unloggedWorkers.length} انتخاب شده)
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="بستن (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Controls: [APP_THEME_BUTTON] Entry Mode Switcher + Close */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            
            {/* [APP_THEME_BUTTON] Mode Switcher */}
            <div className="h-11 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setEntryMode('individual')}
                className={`relative h-full flex items-center gap-2 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer ${
                  entryMode === 'individual'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-bold px-3.5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50 px-2.5'
                }`}
                title={language === 'fa' ? 'ثبت انفرادی پرسنل' : 'Individual'}
              >
                <User className="w-4 h-4 shrink-0" />
                {entryMode === 'individual' && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {language === 'fa' ? 'ثبت انفرادی' : 'Individual'}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setEntryMode('group')}
                className={`relative h-full flex items-center gap-2 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer ${
                  entryMode === 'group'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-bold px-3.5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50 px-2.5'
                }`}
                title={language === 'fa' ? 'ثبت گروهی بر اساس اکیپ' : 'Group'}
              >
                <Users className="w-4 h-4 shrink-0" />
                {entryMode === 'group' && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {language === 'fa' ? 'ثبت گروهی' : 'Group'}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
              title="بستن (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>

      {/* 2. MAIN SCROLLABLE WORKSPACE */}
      <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950/70">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">

          {/* Success Toast Banner */}
          {toastMessage && (
            <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Modern Smart Date & Filter Bar */}
          <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Quick Date Stepper Navigation */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleShiftDate(-1)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-90 cursor-pointer"
                  title="روز قبل"
                >
                  {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <div className="flex items-center gap-2 px-3 py-1">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-bold text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleShiftDate(1)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-90 cursor-pointer"
                  title="روز بعد"
                >
                  {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Jump to Today Button */}
              {selectedDate !== getTodayDateString() && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className="px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'fa' ? 'امروز' : 'Today'}</span>
                </button>
              )}
            </div>

            {/* Filter by Section & Selection Helpers */}
            <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
              
              {/* Project Section Filter (if applicable) */}
              {entryMode === 'individual' && projectSections.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium">
                  <Layers className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <select
                    value={filterModalSection}
                    onChange={(e) => setFilterModalSection(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-white dark:bg-slate-800">
                      {t('allSections') || 'همه بخش‌ها'}
                    </option>
                    {projectSections.map((sec) => (
                      <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                        {sec.name}
                      </option>
                    ))}
                    <option value="unassigned" className="bg-white dark:bg-slate-800">
                      {t('noSection') || 'بدون بخش (عمومی)'}
                    </option>
                  </select>
                </div>
              )}

              {/* Bulk Section Assign when multi-selected */}
              {projectSections.length > 0 && selectedCount > 1 && entryMode === 'individual' && (
                <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/60 px-3 py-1.5 rounded-2xl border border-sky-200/80 dark:border-sky-800/80 text-xs">
                  <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 whitespace-nowrap">
                    {t('bulkAssignSection') || 'تغییر بخش گروهی'}:
                  </span>
                  <select
                    onChange={(e) => {
                      if (e.target.value !== '__noop__') {
                        handleBulkAssignSection(e.target.value);
                      }
                    }}
                    defaultValue="__noop__"
                    className="bg-transparent text-xs font-bold text-sky-900 dark:text-sky-200 focus:outline-none cursor-pointer"
                  >
                    <option value="__noop__" disabled className="bg-white dark:bg-slate-800">
                      -- انتخاب --
                    </option>
                    <option value="" className="bg-white dark:bg-slate-800">
                      {t('noSection') || 'عمومی'}
                    </option>
                    {projectSections.map((sec) => (
                      <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select All / Deselect All Pill buttons */}
              {entryMode === 'individual' && unloggedWorkers.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                    title={t('selectAll')}
                  >
                    {t('selectAll')}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                    title={t('deselectAll')}
                  >
                    {t('deselectAll')}
                  </button>
                </div>
              )}

            </div>

          </div>

          {/* Group Mode Configuration Card */}
          {entryMode === 'group' && (
            <div className="p-5 sm:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Users className="w-5 h-5 text-sky-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  تنظیمات حضور و غیاب گروهی (اکیپ)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    انتخاب گروه کاری
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- گروه را انتخاب کنید --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {selectedGroupId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      {t('attendanceType')}
                    </label>
                    <select
                      value={groupConfig.type}
                      onChange={(e) => setGroupConfig({...groupConfig, type: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                    >
                      <option value="full">{t('fullDayOption')}</option>
                      <option value="half">{t('halfDayOption')}</option>
                      <option value="hourly">{t('hourlyOnlyOption')}</option>
                      <option value="absent">{t('absentOption')}</option>
                    </select>
                  </div>
                )}
              </div>

              {selectedGroupId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {groupConfig.type !== 'absent' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        {t('overtime')} ({t('hoursShort')})
                      </label>
                      <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden p-1">
                        <button 
                          type="button" 
                          onClick={() => setGroupConfig(prev => ({...prev, overtimeHours: Math.max(0, prev.overtimeHours - 0.5)}))} 
                          className="w-10 h-8 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-xl font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center font-mono font-black text-sm text-slate-900 dark:text-white">
                          {formatHoursAndMinutes(groupConfig.overtimeHours, language)}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setGroupConfig(prev => ({...prev, overtimeHours: prev.overtimeHours + 0.5}))} 
                          className="w-10 h-8 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-xl font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      {t('notesOptional')}
                    </label>
                    <input
                      type="text"
                      value={groupConfig.notes}
                      onChange={(e) => setGroupConfig({...groupConfig, notes: e.target.value})}
                      placeholder="توضیحات و شرح کار اکیپ..."
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Case A: All active workers are already logged */}
          {unloggedWorkers.length === 0 && (
            <div className="p-8 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 rounded-3xl text-center space-y-2 backdrop-blur-md">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-emerald-800 dark:text-emerald-300 pt-2">
                {t('allWorkersAlreadyLoggedNotice')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                {t('allWorkersAlreadyLoggedSubtitle')}
              </p>
            </div>
          )}

          {/* Section 1: Workers Available to Log (Modern Redesigned Cards) */}
          {entryMode === 'individual' && unloggedWorkers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 px-1">
                <span>{t('readyToLogCount', { count: filteredUnloggedWorkers.length })}</span>
                <span className="text-slate-400 font-medium">
                  {selectedCount} نفر فعال برای ثبت
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredUnloggedWorkers.map((worker) => {
                  const isChecked = !!selectedWorkers[worker.id];
                  const cfg = workerConfigs[worker.id] || { type: 'full', overtimeHours: 0, notes: '' };
                  const pay = calculateWorkerDayPay(worker);
                  const { hours, minutes } = fromDecimalHours(cfg.overtimeHours);

                  return (
                    <div
                      key={worker.id}
                      className={`group relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                        isChecked
                          ? 'bg-white/90 dark:bg-slate-900/90 border-sky-400 dark:border-sky-500 shadow-md shadow-sky-500/10 backdrop-blur-xl'
                          : 'bg-white/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 opacity-60 hover:opacity-90'
                      }`}
                    >
                      <div className="p-4 sm:p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                        
                        {/* Upper Header: Worker Meta, Checkbox, Wage Preview */}
                        <div className="flex items-center justify-between gap-3">
                          
                          <div 
                            onClick={() => toggleWorkerSelection(worker.id)}
                            className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
                          >
                            {/* Modern Soft Square Checkbox */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                              isChecked
                                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-transparent border border-slate-300 dark:border-slate-700 group-hover:border-sky-400'
                            }`}>
                              <Check className="w-5 h-5 stroke-[2.8]" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWorkerProfile(worker.id);
                                  }}
                                  className="font-black text-sm sm:text-base text-slate-900 dark:text-white hover:text-sky-500 dark:hover:text-sky-400 transition-colors truncate"
                                  title="پروفایل پرسنل"
                                >
                                  {worker.name}
                                </span>

                                {projectSections.length > 0 && cfg.sectionId && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60 shrink-0">
                                    <Layers className="w-3 h-3 text-sky-500" />
                                    <span>{projectSections.find(s => s.id === cfg.sectionId)?.name || ''}</span>
                                  </span>
                                )}

                                {((Boolean(worker.defaultSectionId) && String(cfg.sectionId || '') !== String(worker.defaultSectionId || '')) || (!worker.defaultSectionId && Boolean(cfg.sectionId))) && (
                                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800 shrink-0">
                                    {t('temporaryForToday') || 'امروز'}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                                {worker.role || 'پرسنل'} • {formatCurrency(worker.dailyRate, currency, language)} / روز
                              </p>
                            </div>
                          </div>

                          {/* Calculated Wage Preview Badge */}
                          {isChecked && (
                            <div className="text-end shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 block">دستمزد امروز</span>
                              <span className="text-sm sm:text-base font-black font-mono text-sky-600 dark:text-sky-400">
                                {formatCurrency(pay.total, currency, language)}
                              </span>
                            </div>
                          )}

                        </div>

                        {/* Interactive Controls when Checked */}
                        {isChecked && (
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                            
                            {/* Day Type Selector [APP_THEME_BUTTON Style] & Overtime Stepper */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              
                              {/* [APP_THEME_BUTTON] Tri-state selector */}
                              <div className="h-9 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner shrink-0">
                                <button
                                  type="button"
                                  onClick={() => updateWorkerConfig(worker.id, 'type', 'full')}
                                  className={`h-full flex items-center gap-1 rounded-xl transition-all duration-200 px-2.5 text-xs cursor-pointer ${
                                    cfg.type === 'full'
                                      ? 'bg-sky-500 text-white font-bold shadow-xs'
                                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                                  }`}
                                >
                                  <span>{t('fullDayOption')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateWorkerConfig(worker.id, 'type', 'half')}
                                  className={`h-full flex items-center gap-1 rounded-xl transition-all duration-200 px-2.5 text-xs cursor-pointer ${
                                    cfg.type === 'half'
                                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                                  }`}
                                >
                                  <span>{t('halfDayOption')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateWorkerConfig(worker.id, 'type', 'hourly')}
                                  className={`h-full flex items-center gap-1 rounded-xl transition-all duration-200 px-2.5 text-xs cursor-pointer ${
                                    cfg.type === 'hourly'
                                      ? 'bg-purple-500 text-white font-bold shadow-xs'
                                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                                  }`}
                                >
                                  <span>{t('hourlyOnlyOption')}</span>
                                </button>
                              </div>

                              {/* Overtime Stepper with Quick Chips */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl px-2.5 py-1 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                                  <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {cfg.type === 'hourly' ? t('workedTimeLabel') : t('overtimeHoursLabel')}:
                                  </span>

                                  {/* Hours */}
                                  <input
                                    type="number"
                                    min="0"
                                    max="24"
                                    value={hours}
                                    onChange={(e) => handleHoursChange(worker.id, e.target.value)}
                                    className="w-7 text-center font-black font-mono text-xs bg-white dark:bg-slate-900 rounded-lg py-0.5 text-slate-900 dark:text-white focus:outline-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">{t('hourShort')}</span>

                                  <span className="font-bold text-slate-400">:</span>

                                  {/* Minutes */}
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    step="5"
                                    value={minutes}
                                    onChange={(e) => handleMinutesChange(worker.id, e.target.value)}
                                    className="w-7 text-center font-black font-mono text-xs bg-white dark:bg-slate-900 rounded-lg py-0.5 text-slate-900 dark:text-white focus:outline-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">{t('minuteShort')}</span>
                                </div>

                                {/* Ergonomic Quick Chips */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => addTime(worker.id, 30)}
                                    className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-sky-600 text-[10px] font-black transition-all active:scale-90"
                                    title="+30 دقیقه"
                                  >
                                    +30د
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => addTime(worker.id, 60)}
                                    className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-sky-600 text-[10px] font-black transition-all active:scale-90"
                                    title="+1 ساعت"
                                  >
                                    +1س
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => addTime(worker.id, 120)}
                                    className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-sky-600 text-[10px] font-black transition-all active:scale-90"
                                    title="+2 ساعت"
                                  >
                                    +2س
                                  </button>
                                  {cfg.overtimeHours > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateWorkerConfig(worker.id, 'overtimeHours', 0)}
                                      className="px-1.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 text-[10px] font-black transition-all active:scale-90"
                                      title="ریست اضافه کاری"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>

                            </div>

                            {/* Section Allocation & Notes Input */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {projectSections.length > 0 && (
                                <div className="sm:col-span-1 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                  <Layers className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  <select
                                    value={cfg.sectionId || ''}
                                    onChange={(e) => updateWorkerConfig(worker.id, 'sectionId', e.target.value || null)}
                                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer w-full"
                                  >
                                    <option value="" className="bg-white dark:bg-slate-800">
                                      {t('noSection') || 'عمومی'}
                                    </option>
                                    {projectSections.map((sec) => (
                                      <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                                        {sec.name} {worker.defaultSectionId === sec.id ? `(${t('defaultSection') || 'پیش‌فرض'})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className={`${projectSections.length > 0 ? 'sm:col-span-2' : 'sm:col-span-3'} flex items-center gap-2 bg-slate-50 dark:bg-slate-800/70 rounded-2xl px-3 py-1.5 border border-slate-200/60 dark:border-slate-700/60`}>
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                  type="text"
                                  value={cfg.notes}
                                  onChange={(e) => updateWorkerConfig(worker.id, 'notes', e.target.value)}
                                  placeholder={t('notesPlaceholder') || 'شرح کارهای انجام‌شده...'}
                                  className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                                />
                              </div>
                            </div>

                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Already Logged Workers Accordion (Clean & Compact) */}
          {alreadyLoggedWorkers.length > 0 && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setIsAlreadyLoggedExpanded(!isAlreadyLoggedExpanded)}
                className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {t('alreadyLoggedSectionTitle')} ({alreadyLoggedWorkers.length} نفر)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      کارکرد این پرسنل قبلاً برای این روز ثبت شده است
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    {isAlreadyLoggedExpanded ? 'بستن لیست' : 'مشاهده و ویرایش'}
                  </span>
                  {isAlreadyLoggedExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isAlreadyLoggedExpanded && (
                <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/80 space-y-2 mt-2">
                  {alreadyLoggedWorkers.map(({ worker, log }) => (
                    <div
                      key={worker.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            openWorkerProfile(worker.id);
                          }}
                          className="font-black text-slate-900 dark:text-white cursor-pointer hover:text-sky-500 hover:underline transition-colors"
                        >
                          {worker.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          log.type === 'hourly'
                            ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400'
                            : log.type === 'half'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDayOption') : t('fullDayOption')}
                        </span>
                        {log.overtimeHours > 0 && (
                          <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono">
                            +{formatHoursAndMinutes(log.overtimeHours, language)}
                          </span>
                        )}
                        {log.notes && (
                          <span className="text-slate-500 dark:text-slate-400 italic text-[11px] truncate max-w-xs">
                            "{log.notes}"
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                        <span className="font-black font-mono text-slate-800 dark:text-slate-200">
                          {formatCurrency(log.totalDayPay, currency, language)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingLog(log)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          title={t('editWorkerRecord')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{t('editWorkerRecord')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 3. EXECUTIVE ACTION DOCK (FLOATING FOOTER) */}
      <div className="border-t border-slate-200/80 dark:border-slate-800 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-lg z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Live Dynamic Figures: Selected Count + Gross Wages + OT Hours */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {summaryTotals.count} {t('workers') || 'پرسنل'}
              </span>
            </div>

            {summaryTotals.count > 0 && (
              <>
                <div className="px-3 py-1.5 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/60 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-sky-500" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">مجموع دستمزد:</span>
                  <span className="text-xs font-black font-mono text-sky-600 dark:text-sky-300">
                    {formatAmount(summaryTotals.totalGrossPay, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                {summaryTotals.totalOtHours > 0 && (
                  <div className="px-3 py-1.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">اضافه‌کاری:</span>
                    <span className="text-xs font-black font-mono text-purple-600 dark:text-purple-300">
                      {formatHoursAndMinutes(summaryTotals.totalOtHours, language)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons: Cancel + Submit */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl transition-all cursor-pointer active:scale-95"
            >
              {t('cancel')} (ESC)
            </button>

            {unloggedWorkers.length > 0 && (
              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isSaving || !canModifyDate(selectedDate) || (entryMode === 'individual' && selectedCount === 0) || (entryMode === 'group' && !selectedGroupId)}
                className="flex-2 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isSaving ? t('savingAttendance') : t('saveBatchAttendance')}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

/**
 * Persistent Multi-Action Floating Action Button (FAB)
 * Speed-dial menu with:
 * 1. ثبت کار روزانه (Daily Attendance)
 * 2. ثبت تسویه (Settlement)
 * 3. ثبت هزینه (Expense)
 */
export function FloatingActionButton({ onOpenDailyLogging, onOpenSettlement, onOpenExpense, onClick }) {
  const { t, language, direction } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (callback) => {
    setIsOpen(false);
    if (callback) {
      callback();
    } else if (onClick) {
      onClick();
    }
  };

  const isRtl = direction === 'rtl';

  return (
    <>
      {/* Backdrop overlay when speed-dial is expanded */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-35 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed bottom-24 md:bottom-8 ${
          isRtl ? 'left-4 sm:left-8' : 'right-4 sm:right-8'
        } z-40 no-print flex flex-col items-center gap-2.5 pointer-events-none`}
      >
        {/* Speed-dial Pop-up Actions */}
        <div
          className={`flex flex-col gap-2.5 transition-all duration-200 origin-bottom ${
            isOpen
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
              : 'opacity-0 scale-75 translate-y-4 pointer-events-none invisible h-0 overflow-hidden'
          }`}
        >
          {/* Action 3: ثبت هزینه پروژه */}
          <button
            type="button"
            onClick={() => handleAction(onOpenExpense)}
            className="group flex items-center gap-2.5 focus:outline-none cursor-pointer pointer-events-auto"
            title={language === 'ku' ? 'تۆمارکردنی خەرجی کارگە' : 'ثبت هزینه جدید پروژه'}
          >
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-slate-700/80 whitespace-nowrap transition-all duration-150 group-hover:scale-105 group-hover:border-rose-300 dark:group-hover:border-rose-700 ${
              isRtl ? 'order-2' : 'order-1'
            }`}>
              {language === 'ku' ? 'تۆمارکردنی خەرجی' : 'ثبت هزینه'}
            </span>
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/35 ring-2 ring-rose-500/20 transition-all duration-200 group-hover:scale-110 active:scale-95 ${
              isRtl ? 'order-1' : 'order-2'
            }`}>
              <Receipt className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
            </div>
          </button>

          {/* Action 2: ثبت تسویه حساب */}
          <button
            type="button"
            onClick={() => handleAction(onOpenSettlement)}
            className="group flex items-center gap-2.5 focus:outline-none cursor-pointer pointer-events-auto"
            title={language === 'ku' ? 'تۆمارکردنی پاکتاوی حیساب' : 'ثبت تسویه حساب پرسنل / گروه'}
          >
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-slate-700/80 whitespace-nowrap transition-all duration-150 group-hover:scale-105 group-hover:border-emerald-300 dark:group-hover:border-emerald-700 ${
              isRtl ? 'order-2' : 'order-1'
            }`}>
              {language === 'ku' ? 'تۆمارکردنی پاکتاو' : 'ثبت تسویه'}
            </span>
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 ring-2 ring-emerald-500/20 transition-all duration-200 group-hover:scale-110 active:scale-95 ${
              isRtl ? 'order-1' : 'order-2'
            }`}>
              <CreditCard className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
            </div>
          </button>

          {/* Action 1: ثبت کار روزانه */}
          <button
            type="button"
            onClick={() => handleAction(onOpenDailyLogging || onClick)}
            className="group flex items-center gap-2.5 focus:outline-none cursor-pointer pointer-events-auto"
            title={language === 'ku' ? 'تۆمارکردنی ئامادەبوونی ڕۆژانە' : 'ثبت کارکرد روزانه پرسنل'}
          >
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-slate-700/80 whitespace-nowrap transition-all duration-150 group-hover:scale-105 group-hover:border-sky-300 dark:group-hover:border-sky-700 ${
              isRtl ? 'order-2' : 'order-1'
            }`}>
              {language === 'ku' ? 'تۆماری کارکردی ڕۆژانە' : 'ثبت کار روزانه'}
            </span>
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-600/35 ring-2 ring-sky-500/20 transition-all duration-200 group-hover:scale-110 active:scale-95 ${
              isRtl ? 'order-1' : 'order-2'
            }`}>
              <CalendarPlus className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
            </div>
          </button>
        </div>

        {/* Main Floating Trigger Button (+) */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={language === 'ku' ? 'کرداری خێرا' : 'عملیات سریع'}
          title={language === 'ku' ? 'کرداری خێرا' : 'عملیات سریع (+)'}
          className={`group relative flex items-center justify-center text-white w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer pointer-events-auto ${
            isOpen
              ? 'bg-gradient-to-tr from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 shadow-slate-900/40 ring-4 ring-slate-400/20'
              : 'bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-sky-600/35 ring-4 ring-sky-500/25'
          }`}
        >
          <Plus 
            className={`w-7 h-7 sm:w-8 sm:h-8 stroke-[2.6] transition-all duration-300 ${
              isOpen ? 'rotate-45 text-rose-300' : 'rotate-0 group-hover:rotate-90 text-white'
            }`} 
          />
        </button>
      </div>
    </>
  );
}
