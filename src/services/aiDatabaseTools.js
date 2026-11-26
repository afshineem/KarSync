import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { calculateWorkerFinancials, getReceiptPeriodEnd } from '../utils/settlementCalculations';
import {
  formatDateDisplay,
  formatHoursAndMinutes,
  jalaliToGregorian,
  getJalaliMonthDays,
  isDateInMonth,
  getTodayDateString,
  normalizeDigits,
  roundCurrency
} from '../utils/formatters';
import { isWorkerInProject } from '../utils/workerScope';

/**
 * Normalize Persian / Kurdish / Arabic / Latin text for tolerant fuzzy search.
 * Unifies ي/ی, ك/ک, ە/ه, آ/أ/إ/ا, removes ZWNJ/diacritics, normalizes digits.
 */
export function normalizeSearchText(input) {
  if (input === null || input === undefined) return '';
  return normalizeDigits(String(input))
    .replace(/[\u200c\u200d\u064b-\u065f\u0670]/g, ' ')
    .replace(/[يئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةە]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalize a date string (supports both Gregorian YYYY-MM-DD and Jalali YYYY/MM/DD or YYYY-MM-DD).
 * Returns Gregorian YYYY-MM-DD or null.
 */
export function normalizeToGregorianDate(rawDate) {
  if (!rawDate) return null;
  const cleaned = normalizeDigits(String(rawDate)).trim().replace(/\//g, '-');
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  let d = parseInt(m[3], 10);
  if (y >= 1300 && y <= 1550) {
    const [gy, gm, gd] = jalaliToGregorian(y, mo, d);
    y = gy;
    mo = gm;
    d = gd;
  }
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Convert a monthKey (either Gregorian '2026-11' or Jalali '1405-09') to a Gregorian { startDate, endDate } range.
 */
export function resolveMonthKeyToRange(rawMonthKey) {
  if (!rawMonthKey) return null;
  const cleaned = normalizeDigits(String(rawMonthKey)).trim().replace(/\//g, '-');
  const m = cleaned.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;

  if (y >= 1300 && y <= 1550) {
    const days = getJalaliMonthDays(y, mo);
    const [sy, sm, sd] = jalaliToGregorian(y, mo, 1);
    const [ey, em, ed] = jalaliToGregorian(y, mo, days);
    return {
      startDate: `${String(sy).padStart(4, '0')}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`,
      endDate: `${String(ey).padStart(4, '0')}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`,
      isJalali: true,
      monthKey: `${y}-${String(mo).padStart(2, '0')}`
    };
  }

  const lastDay = new Date(y, mo, 0).getDate();
  return {
    startDate: `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-01`,
    endDate: `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    isJalali: false,
    monthKey: `${y}-${String(mo).padStart(2, '0')}`
  };
}

function fmtDate(isoDate, language, calendarType) {
  if (!isoDate) return null;
  const clean = String(isoDate).slice(0, 10);
  try {
    const display = formatDateDisplay(clean, language, null, calendarType);
    return display && display !== clean ? `${display} (${clean})` : clean;
  } catch {
    return clean;
  }
}

function filterByDateRange(items, dateExtractor, startDate, endDate, monthKey, calendarType, language) {
  const normStart = normalizeToGregorianDate(startDate);
  const normEnd = normalizeToGregorianDate(endDate);
  const monthRange = resolveMonthKeyToRange(monthKey);

  return items.filter((item) => {
    const d = String(dateExtractor(item) || '').slice(0, 10);
    if (!d) return false;
    if (normStart && d < normStart) return false;
    if (normEnd && d > normEnd) return false;
    if (monthRange) {
      if (d < monthRange.startDate || d > monthRange.endDate) return false;
    } else if (monthKey) {
      if (!isDateInMonth(d, monthKey, calendarType, language)) return false;
    }
    return true;
  });
}

function resolveAllowedProjects(allProjects, context) {
  const activeOnly = (allProjects || []).filter((p) => !p.deletedAt);
  if (!context?.canAccessProject) return activeOnly;
  const permitted = activeOnly.filter((p) => context.canAccessProject(p.id));
  return permitted.length > 0 ? permitted : activeOnly;
}

function resolveTargetProjectId(requestedProjectId, requestedProjectName, allowedProjects, activeProjectId) {
  if (requestedProjectId === 'all' || requestedProjectName === 'all') {
    return null; // Explicitly query across all permitted projects
  }
  if (requestedProjectId) {
    const match = allowedProjects.find((p) => String(p.id) === String(requestedProjectId));
    if (match) return match.id;
  }
  if (requestedProjectName) {
    const q = normalizeSearchText(requestedProjectName);
    const match = allowedProjects.find((p) => normalizeSearchText(p.name).includes(q));
    if (match) return match.id;
  }
  return activeProjectId || allowedProjects[0]?.id || DEFAULT_PROJECT_ID;
}

function isRecordInProjects(recordProjectId, targetProjectId, allowedProjectIdsSet) {
  const pid = recordProjectId || DEFAULT_PROJECT_ID;
  if (targetProjectId) {
    if (targetProjectId === DEFAULT_PROJECT_ID) {
      return !recordProjectId || recordProjectId === DEFAULT_PROJECT_ID;
    }
    return String(pid) === String(targetProjectId);
  }
  return allowedProjectIdsSet.has(String(pid)) || (!recordProjectId && allowedProjectIdsSet.has(DEFAULT_PROJECT_ID));
}

function matchWorkerByQuery(workers, query) {
  const q = normalizeSearchText(query);
  if (!q) return workers;
  const tokens = q.split(' ').filter(Boolean);

  // 1. Exact full name match
  const exact = workers.filter((w) => normalizeSearchText(w.name) === q);
  if (exact.length > 0) return exact;

  // 2. Starts-with or includes all tokens in name
  const allTokensInName = workers.filter((w) => {
    const normName = normalizeSearchText(w.name);
    return tokens.every((tk) => normName.includes(tk));
  });
  if (allTokensInName.length > 0) return allTokensInName;

  // 3. Fallback: match across name, role, phone
  return workers.filter((w) => {
    const hay = normalizeSearchText(`${w.name || ''} ${w.role || ''} ${w.phone || ''}`);
    return tokens.every((tk) => hay.includes(tk));
  });
}

/**
 * Returns Gemini Function Declarations dynamically filtered by the active user's RBAC permissions.
 */
export function getGeminiToolDeclarations(permissions = {}) {
  const canAttendance = permissions.canAttendance !== false;
  const canFinancials = permissions.canFinancials !== false;
  const canExpenses = permissions.canExpenses !== false;
  const canAccounting = permissions.canAccounting !== false;

  const declarations = [
    {
      name: 'list_projects_and_overview',
      description: 'List all accessible workshop projects, their currencies, project sections, work groups, and active personnel counts. Call this when the user asks about projects, sections, groups, or a general workshop overview.',
      parameters: {
        type: 'OBJECT',
        properties: {}
      }
    }
  ];

  if (canAttendance) {
    declarations.push(
      {
        name: 'search_workers',
        description: 'Search personnel/workers by name, partial name, role, phone, or group. Returns matching workers with their ID, name, role, wage rates, group, and project. Use this to look up workers or list all personnel.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Name, partial name, role, or phone to search for. Leave empty to list all workers.'
            },
            project_name: {
              type: 'STRING',
              description: 'Optional project name filter, or "all" for all accessible projects.'
            },
            include_archived: {
              type: 'BOOLEAN',
              description: 'Whether to include archived/inactive workers (default false).'
            }
          }
        }
      },
      {
        name: 'get_worker_attendance_report',
        description: 'Get the exact, deterministic attendance and wage report for a specific worker (days worked, full/half/hourly breakdown, overtime hours, daily logs, advances, settlements, loans, and net balance due). ALWAYS use this tool before quoting any attendance or wage figures for a person.',
        parameters: {
          type: 'OBJECT',
          properties: {
            worker_id: {
              type: 'STRING',
              description: 'Exact worker ID if known from search_workers.'
            },
            worker_name: {
              type: 'STRING',
              description: 'Worker name or partial name (Persian/Kurdish/English). Can be used directly without calling search_workers first.'
            },
            scope: {
              type: 'STRING',
              description: 'Period scope: "unsettled" (current open unpaid period since last settlement — default when asking about current balance or open work), "month" (a specific month), "date_range" (between start_date and end_date), or "all" (complete history).'
            },
            month_key: {
              type: 'STRING',
              description: 'Optional month key in YYYY-MM format (supports both Gregorian like "2026-11" and Shamsi/Jalali like "1405-09").'
            },
            start_date: {
              type: 'STRING',
              description: 'Optional start date (YYYY-MM-DD, Gregorian or Shamsi).'
            },
            end_date: {
              type: 'STRING',
              description: 'Optional end date (YYYY-MM-DD, Gregorian or Shamsi).'
            },
            include_daily_logs: {
              type: 'BOOLEAN',
              description: 'Set true to include individual day-by-day attendance entries (default true, capped to 45 most recent entries).'
            }
          }
        }
      },
      {
        name: 'get_team_attendance_overview',
        description: 'Get team-wide attendance & payroll summaries across all workers: who worked or was absent on a specific date, top overtime earners, total unsettled payroll debt owed to all workers, or monthly attendance rankings.',
        parameters: {
          type: 'OBJECT',
          properties: {
            project_name: {
              type: 'STRING',
              description: 'Optional project name, or "all" for all accessible projects. Defaults to active project.'
            },
            date: {
              type: 'STRING',
              description: 'Specific single date (YYYY-MM-DD, Gregorian or Shamsi) to check who was present vs absent.'
            },
            month_key: {
              type: 'STRING',
              description: 'Optional month key (YYYY-MM Gregorian or Shamsi) to aggregate team attendance for that month.'
            },
            start_date: {
              type: 'STRING',
              description: 'Optional range start date (YYYY-MM-DD).'
            },
            end_date: {
              type: 'STRING',
              description: 'Optional range end date (YYYY-MM-DD).'
            },
            sort_by: {
              type: 'STRING',
              description: 'How to rank workers: "net_due" (highest unpaid balance), "overtime" (most overtime hours), "days" (most working days), or "name".'
            },
            limit: {
              type: 'NUMBER',
              description: 'Maximum number of workers to return in detailed list (default 25).'
            }
          }
        }
      }
    );
  }

  if (canFinancials) {
    declarations.push({
      name: 'get_worker_payments_and_loans',
      description: 'Get advances, settlement receipts, and staff loans for a specific worker or across the project.',
      parameters: {
        type: 'OBJECT',
        properties: {
          worker_name: {
            type: 'STRING',
            description: 'Optional worker name filter. Leave empty for all workers in project.'
          },
          worker_id: {
            type: 'STRING',
            description: 'Optional exact worker ID.'
          },
          type: {
            type: 'STRING',
            description: 'Filter payments by type: "all", "advance", "settlement", or "loans".'
          },
          month_key: {
            type: 'STRING',
            description: 'Optional YYYY-MM filter (Gregorian or Shamsi).'
          },
          start_date: {
            type: 'STRING',
            description: 'Optional start date (YYYY-MM-DD).'
          },
          end_date: {
            type: 'STRING',
            description: 'Optional end date (YYYY-MM-DD).'
          },
          project_name: {
            type: 'STRING',
            description: 'Optional project name or "all".'
          }
        }
      }
    });
  }

  if (canExpenses) {
    declarations.push({
      name: 'get_expenses_summary',
      description: 'Query workshop expenses, invoices, categories, payees, and unpaid bills. Returns totals, category breakdown, and matching expense records.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: {
            type: 'STRING',
            description: 'Optional project name or "all". Defaults to active project.'
          },
          month_key: {
            type: 'STRING',
            description: 'Optional YYYY-MM filter (Gregorian or Shamsi).'
          },
          start_date: {
            type: 'STRING',
            description: 'Optional start date (YYYY-MM-DD).'
          },
          end_date: {
            type: 'STRING',
            description: 'Optional end date (YYYY-MM-DD).'
          },
          category_query: {
            type: 'STRING',
            description: 'Optional expense category name filter.'
          },
          query: {
            type: 'STRING',
            description: 'Optional keyword search across expense title, description, or payee/person name.'
          },
          payment_status: {
            type: 'STRING',
            description: 'Optional filter: "all", "paid", or "unpaid" (credit/debt).'
          }
        }
      }
    });
  }

  if (canAccounting) {
    declarations.push(
      {
        name: 'get_accounts_and_cashflow',
        description: 'Get live balances of financial accounts (cash boxes & bank accounts), treasury incomes, account transfers, and net cashflow summary.',
        parameters: {
          type: 'OBJECT',
          properties: {
            project_name: {
              type: 'STRING',
              description: 'Optional project name or "all". Defaults to active project.'
            },
            month_key: {
              type: 'STRING',
              description: 'Optional YYYY-MM filter for period inflows/outflows (account balances are always live cumulative).'
            },
            start_date: {
              type: 'STRING',
              description: 'Optional start date for period inflows/outflows.'
            },
            end_date: {
              type: 'STRING',
              description: 'Optional end date for period inflows/outflows.'
            }
          }
        }
      },
      {
        name: 'get_contracts_and_cheques',
        description: 'Query contractor contracts (progress, estimated/final value, status), commercial cheques (inward/outward, due dates, overdue/upcoming, status), and counterparties.',
        parameters: {
          type: 'OBJECT',
          properties: {
            focus: {
              type: 'STRING',
              description: 'What to query: "all", "contracts", "cheques", or "counterparties".'
            },
            project_name: {
              type: 'STRING',
              description: 'Optional project name or "all".'
            },
            query: {
              type: 'STRING',
              description: 'Optional search term for contract title, counterparty name, or cheque number.'
            },
            status: {
              type: 'STRING',
              description: 'Optional status filter (e.g. "active", "overdue", "in_hand", "issued", "cleared", "bounced", "completed").'
            }
          }
        }
      }
    );
  }

  return declarations;
}

/**
 * Executes a single Gemini tool call locally against Dexie IndexedDB (0 bytes Supabase Egress).
 */
export async function executeAiDatabaseTool(toolName, args = {}, context = {}) {
  const {
    activeProjectId = DEFAULT_PROJECT_ID,
    currency = 'IQD',
    language = 'fa',
    calendarType = null,
    canAccessProject = null,
    permissions = {}
  } = context;

  const allProjects = db.projects ? await db.projects.toArray() : [];
  const allowedProjects = resolveAllowedProjects(allProjects, { canAccessProject });
  const allowedProjectIdsSet = new Set(allowedProjects.map((p) => String(p.id)));
  const projectMap = new Map(allowedProjects.map((p) => [String(p.id), p]));

  const getCurrencyForProject = (pid) => {
    const p = projectMap.get(String(pid || activeProjectId));
    return p?.currency || p?.base_currency || currency || 'IQD';
  };

  try {
    // ------------------------------------------------------------------
    // 1. list_projects_and_overview
    // ------------------------------------------------------------------
    if (toolName === 'list_projects_and_overview') {
      const [allWorkers, allSections, allGroups] = await Promise.all([
        db.workers ? db.workers.toArray() : [],
        db.projectSections ? db.projectSections.toArray() : [],
        db.groups ? db.groups.toArray() : []
      ]);
      const activeWorkers = allWorkers.filter((w) => !w.deletedAt && !w.isArchived && w.status !== 'archived' && Number(w.isActive) !== 0);

      return {
        activeProjectId,
        totalAccessibleProjects: allowedProjects.length,
        projects: allowedProjects.map((p) => {
          const pWorkers = activeWorkers.filter((w) => isWorkerInProject(w, p.id));
          const pSections = allSections.filter((s) => !s.deletedAt && String(s.projectId) === String(p.id));
          const pGroups = allGroups.filter((g) => !g.deletedAt && !g.isArchived && String(g.projectId) === String(p.id));
          return {
            id: p.id,
            name: p.name,
            currency: p.currency || p.base_currency || 'IQD',
            status: p.status || 'active',
            isActiveProject: String(p.id) === String(activeProjectId),
            activeWorkersCount: pWorkers.length,
            sections: pSections.map((s) => s.name),
            groups: pGroups.map((g) => g.name)
          };
        })
      };
    }

    // ------------------------------------------------------------------
    // 2. search_workers
    // ------------------------------------------------------------------
    if (toolName === 'search_workers') {
      if (permissions.canAttendance === false) return { error: 'ACCESS_DENIED' };
      const [allWorkers, allGroups] = await Promise.all([
        db.workers ? db.workers.toArray() : [],
        db.groups ? db.groups.toArray() : []
      ]);
      const groupMap = new Map(allGroups.map((g) => [String(g.id), g.name]));
      const includeArchived = Boolean(args.include_archived);
      const targetPid = args.project_name
        ? resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId)
        : null;

      let pool = allWorkers.filter((w) => {
        if (w.deletedAt) return false;
        if (!includeArchived && (w.isArchived || w.status === 'archived' || Number(w.isActive) === 0)) return false;
        if (targetPid) return isWorkerInProject(w, targetPid);
        return w.isGlobal || allowedProjectIdsSet.has(String(w.projectId || DEFAULT_PROJECT_ID));
      });

      const matched = matchWorkerByQuery(pool, args.query || '');
      return {
        totalMatched: matched.length,
        workers: matched.slice(0, 40).map((w) => ({
          id: w.id,
          name: w.name,
          role: w.role || '',
          phone: w.phone || '',
          wageType: w.wageType || 'standard',
          dailyRate: Number(w.dailyRate) || 0,
          overtimeHourlyRate: Number(w.overtimeHourlyRate) || 0,
          monthlySalary: Number(w.monthlySalary) || 0,
          projectId: w.projectId || DEFAULT_PROJECT_ID,
          projectName: projectMap.get(String(w.projectId || DEFAULT_PROJECT_ID))?.name || '',
          currency: getCurrencyForProject(w.projectId),
          groupName: w.groupId ? (groupMap.get(String(w.groupId)) || '') : '',
          isGlobal: Boolean(w.isGlobal),
          isArchived: Boolean(w.isArchived || w.status === 'archived')
        }))
      };
    }

    // ------------------------------------------------------------------
    // 3. get_worker_attendance_report
    // ------------------------------------------------------------------
    if (toolName === 'get_worker_attendance_report') {
      if (permissions.canAttendance === false) return { error: 'ACCESS_DENIED' };
      const [allWorkers, allLogs, allPayments, allLoans, allSections] = await Promise.all([
        db.workers ? db.workers.toArray() : [],
        db.attendanceLogs ? db.attendanceLogs.toArray() : [],
        db.payments ? db.payments.toArray() : [],
        db.loans ? db.loans.toArray() : [],
        db.projectSections ? db.projectSections.toArray() : []
      ]);

      const accessibleWorkers = allWorkers.filter(
        (w) => !w.deletedAt && (w.isGlobal || allowedProjectIdsSet.has(String(w.projectId || DEFAULT_PROJECT_ID)))
      );

      let worker = null;
      if (args.worker_id) {
        worker = accessibleWorkers.find((w) => String(w.id) === String(args.worker_id)) || null;
      }
      if (!worker && args.worker_name) {
        const matches = matchWorkerByQuery(accessibleWorkers, args.worker_name);
        if (matches.length === 1) {
          worker = matches[0];
        } else if (matches.length > 1) {
          // Prefer exact active project match if only one is in active project and exact name
          const activeMatches = matches.filter((w) => !w.isArchived && isWorkerInProject(w, activeProjectId));
          if (activeMatches.length === 1 && matches.every((w) => normalizeSearchText(w.name) !== normalizeSearchText(args.worker_name))) {
            worker = activeMatches[0];
          } else {
            return {
              status: 'AMBIGUOUS_WORKER',
              query: args.worker_name,
              message: 'Multiple workers match this name. Ask the user to clarify which person they mean, or summarize clearly.',
              candidates: matches.slice(0, 10).map((w) => ({
                id: w.id,
                name: w.name,
                role: w.role || '',
                projectName: projectMap.get(String(w.projectId || DEFAULT_PROJECT_ID))?.name || '',
                isArchived: Boolean(w.isArchived || w.status === 'archived')
              }))
            };
          }
        }
      }

      if (!worker) {
        return {
          status: 'NOT_FOUND',
          query: args.worker_name || args.worker_id || '',
          availableWorkerSample: accessibleWorkers.filter((w) => !w.isArchived).slice(0, 15).map((w) => w.name)
        };
      }

      const wId = String(worker.id);
      const workerCurrency = getCurrencyForProject(worker.projectId);
      const sectionMap = new Map(allSections.map((s) => [String(s.id), s.name]));

      // Always compute authoritative unsettled financial status via KarSync's engine
      const fin = calculateWorkerFinancials(worker, allLogs, allPayments, workerCurrency, allLoans);

      const workerAllLogs = allLogs
        .filter((l) => String(l.workerId) === wId && !l.deletedAt)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const workerAllPayments = allPayments
        .filter((p) => String(p.workerId) === wId && !p.deletedAt && p.status !== 'deleted')
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));

      const settlements = workerAllPayments.filter(
        (p) => p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled'
      );
      const latestSettlement = settlements[0] || null;
      const lastSettlementDate = latestSettlement
        ? (getReceiptPeriodEnd(latestSettlement) || latestSettlement.date || latestSettlement.createdAt?.slice(0, 10))
        : null;

      // Determine requested scope
      const hasDateFilters = Boolean(args.month_key || args.start_date || args.end_date);
      const scope = args.scope || (hasDateFilters ? (args.month_key ? 'month' : 'date_range') : 'unsettled');

      let scopedLogs = [];
      let scopedPayments = [];
      if (scope === 'unsettled') {
        scopedLogs = (fin?.unsettledLogs || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        scopedPayments = fin?.unsettledAdvances || [];
      } else if (scope === 'all') {
        scopedLogs = workerAllLogs;
        scopedPayments = workerAllPayments;
      } else {
        scopedLogs = filterByDateRange(
          workerAllLogs,
          (l) => l.date,
          args.start_date,
          args.end_date,
          args.month_key,
          calendarType,
          language
        );
        scopedPayments = filterByDateRange(
          workerAllPayments,
          (p) => p.date || p.createdAt?.slice(0, 10),
          args.start_date,
          args.end_date,
          args.month_key,
          calendarType,
          language
        );
      }

      let fullDays = 0;
      let halfDays = 0;
      let hourlyDays = 0;
      let leaveDays = 0;
      let totalOtHours = 0;
      let totalGrossPay = 0;
      const sectionBreakdown = {};

      for (const l of scopedLogs) {
        const ot = Number(l.overtimeHours) || 0;
        const pay = Number(l.totalDayPay) || 0;
        totalOtHours += ot;
        totalGrossPay += pay;
        if (l.type === 'full' || !l.type) fullDays++;
        else if (l.type === 'half') halfDays++;
        else if (l.type === 'hourly') hourlyDays++;
        else if (l.type === 'leave' || l.type === 'paid_leave') leaveDays++;

        const secName = l.sectionId ? (sectionMap.get(String(l.sectionId)) || 'سایر') : 'عمومی';
        sectionBreakdown[secName] = (sectionBreakdown[secName] || 0) + 1;
      }

      const advancesList = scopedPayments.filter(
        (p) => p.type !== 'settlement' && p.type !== 'Settlement' && p.status !== 'settled'
      );
      const settlementsInScope = scopedPayments.filter(
        (p) => p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled'
      );
      const totalAdvancesInScope = advancesList.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalSettledPaidInScope = settlementsInScope.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      const activeWorkerLoans = allLoans.filter(
        (ln) => String(ln.workerId) === wId && !ln.deletedAt && ln.status !== 'deleted' && ln.status !== 'paid_off' && Number(ln.remainingBalance) > 0
      );

      const includeDailyLogs = args.include_daily_logs !== false;
      const dailyLogsFormatted = includeDailyLogs
        ? scopedLogs.slice(-45).map((l) => ({
            date: fmtDate(l.date, language, calendarType),
            type: l.type || 'full',
            overtimeHours: Number(l.overtimeHours) || 0,
            overtimeFormatted: formatHoursAndMinutes(Number(l.overtimeHours) || 0, language),
            dayPay: roundCurrency(l.totalDayPay, workerCurrency),
            isSettled: Boolean(l.isSettled),
            section: l.sectionId ? (sectionMap.get(String(l.sectionId)) || null) : null,
            notes: l.notes || ''
          }))
        : undefined;

      return {
        worker: {
          id: worker.id,
          name: worker.name,
          role: worker.role || '',
          projectName: projectMap.get(String(worker.projectId || DEFAULT_PROJECT_ID))?.name || '',
          currency: workerCurrency,
          wageType: worker.wageType || 'standard',
          dailyRate: Number(worker.dailyRate) || 0,
          overtimeHourlyRate: Number(worker.overtimeHourlyRate) || 0,
          monthlySalary: Number(worker.monthlySalary) || 0
        },
        requestedScope: scope,
        settlementStatus: {
          hasPreviousSettlement: Boolean(latestSettlement),
          lastSettlementDate: fmtDate(lastSettlementDate, language, calendarType),
          totalHistoricalSettlementsCount: settlements.length
        },
        authoritativeUnsettledBalance: fin ? {
          unsettledLogsCount: (fin.unsettledLogs || []).length,
          unsettledGrossPay: roundCurrency(fin.unsettledGrossPay ?? fin.totalUnsettledEarned ?? 0, workerCurrency),
          unsettledAdvances: roundCurrency(fin.unsettledAdvancesTotal ?? fin.totalUnsettledAdvances ?? 0, workerCurrency),
          unsettledNetDue: roundCurrency(fin.unsettledNetDue ?? 0, workerCurrency)
        } : null,
        periodSummary: {
          firstDate: fmtDate(scopedLogs[0]?.date, language, calendarType),
          lastDate: fmtDate(scopedLogs[scopedLogs.length - 1]?.date, language, calendarType),
          totalDaysCount: scopedLogs.length,
          fullDays,
          halfDays,
          hourlyDays,
          leaveDays,
          totalOvertimeHours: Number(totalOtHours.toFixed(2)),
          totalOvertimeFormatted: formatHoursAndMinutes(totalOtHours, language),
          totalGrossPay: roundCurrency(totalGrossPay, workerCurrency),
          totalAdvances: roundCurrency(totalAdvancesInScope, workerCurrency),
          totalSettlementsPaidInScope: roundCurrency(totalSettledPaidInScope, workerCurrency),
          netForScope: scope === 'unsettled' && fin
            ? roundCurrency(fin.unsettledNetDue, workerCurrency)
            : roundCurrency(totalGrossPay - totalAdvancesInScope - totalSettledPaidInScope, workerCurrency),
          sectionBreakdown
        },
        advancesInScope: advancesList.slice(0, 20).map((p) => ({
          date: fmtDate(p.date || p.createdAt?.slice(0, 10), language, calendarType),
          amount: roundCurrency(p.amount, workerCurrency),
          note: p.note || p.description || ''
        })),
        activeLoans: activeWorkerLoans.map((ln) => ({
          principalAmount: roundCurrency(ln.principalAmount, workerCurrency),
          remainingBalance: roundCurrency(ln.remainingBalance, workerCurrency),
          monthlyInstallment: roundCurrency(ln.monthlyInstallment, workerCurrency),
          status: ln.status
        })),
        dailyLogsTruncated: scopedLogs.length > 45,
        dailyLogs: dailyLogsFormatted
      };
    }

    // ------------------------------------------------------------------
    // 4. get_team_attendance_overview
    // ------------------------------------------------------------------
    if (toolName === 'get_team_attendance_overview') {
      if (permissions.canAttendance === false) return { error: 'ACCESS_DENIED' };
      const [allWorkers, allLogs, allPayments, allLoans] = await Promise.all([
        db.workers ? db.workers.toArray() : [],
        db.attendanceLogs ? db.attendanceLogs.toArray() : [],
        db.payments ? db.payments.toArray() : [],
        db.loans ? db.loans.toArray() : []
      ]);

      const targetPid = resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId);
      const curr = getCurrencyForProject(targetPid);
      const teamWorkers = allWorkers.filter((w) => {
        if (w.deletedAt || w.isArchived || w.status === 'archived' || Number(w.isActive) === 0) return false;
        if (targetPid) return isWorkerInProject(w, targetPid);
        return w.isGlobal || allowedProjectIdsSet.has(String(w.projectId || DEFAULT_PROJECT_ID));
      });

      // Specific single date presence/absence check
      if (args.date) {
        const targetIso = normalizeToGregorianDate(args.date);
        const dayLogs = allLogs.filter((l) => !l.deletedAt && String(l.date).slice(0, 10) === targetIso);
        const logsByWorker = new Map(dayLogs.map((l) => [String(l.workerId), l]));

        const present = [];
        const absent = [];
        let totalDayPayroll = 0;
        let totalDayOt = 0;

        for (const w of teamWorkers) {
          const log = logsByWorker.get(String(w.id));
          if (log) {
            const ot = Number(log.overtimeHours) || 0;
            const pay = Number(log.totalDayPay) || 0;
            totalDayPayroll += pay;
            totalDayOt += ot;
            present.push({
              name: w.name,
              role: w.role || '',
              type: log.type || 'full',
              overtimeHours: ot,
              dayPay: roundCurrency(pay, curr)
            });
          } else {
            absent.push({ name: w.name, role: w.role || '' });
          }
        }

        return {
          mode: 'single_date',
          date: fmtDate(targetIso, language, calendarType),
          projectName: targetPid ? (projectMap.get(String(targetPid))?.name || '') : 'All Projects',
          currency: curr,
          totalActiveWorkers: teamWorkers.length,
          presentCount: present.length,
          absentCount: absent.length,
          totalDayOvertimeHours: Number(totalDayOt.toFixed(2)),
          totalDayPayroll: roundCurrency(totalDayPayroll, curr),
          presentWorkers: present,
          absentWorkers: absent
        };
      }

      // Period or unsettled team ranking & totals
      const hasPeriod = Boolean(args.month_key || args.start_date || args.end_date);
      const rows = [];
      let totalUnsettledNetDue = 0;
      let totalPeriodGross = 0;
      let totalPeriodOt = 0;
      let totalPeriodDays = 0;

      for (const w of teamWorkers) {
        const wCurr = getCurrencyForProject(w.projectId || targetPid);
        const fin = calculateWorkerFinancials(w, allLogs, allPayments, wCurr, allLoans);
        const unsettledNet = Number(fin?.unsettledNetDue) || 0;
        totalUnsettledNetDue += unsettledNet;

        let scopedLogs = [];
        if (hasPeriod) {
          const wLogs = allLogs.filter((l) => String(l.workerId) === String(w.id) && !l.deletedAt);
          scopedLogs = filterByDateRange(wLogs, (l) => l.date, args.start_date, args.end_date, args.month_key, calendarType, language);
        } else {
          scopedLogs = fin?.unsettledLogs || [];
        }

        const days = scopedLogs.length;
        const ot = scopedLogs.reduce((s, l) => s + (Number(l.overtimeHours) || 0), 0);
        const gross = scopedLogs.reduce((s, l) => s + (Number(l.totalDayPay) || 0), 0);
        totalPeriodDays += days;
        totalPeriodOt += ot;
        totalPeriodGross += gross;

        rows.push({
          id: w.id,
          name: w.name,
          role: w.role || '',
          daysWorked: days,
          overtimeHours: Number(ot.toFixed(2)),
          periodGrossPay: roundCurrency(gross, wCurr),
          unsettledNetDue: roundCurrency(unsettledNet, wCurr),
          currency: wCurr
        });
      }

      const sortBy = args.sort_by || (hasPeriod ? 'days' : 'net_due');
      rows.sort((a, b) => {
        if (sortBy === 'overtime') return b.overtimeHours - a.overtimeHours;
        if (sortBy === 'days') return b.daysWorked - a.daysWorked;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return b.unsettledNetDue - a.unsettledNetDue;
      });

      const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 60);
      return {
        mode: hasPeriod ? 'period_overview' : 'unsettled_overview',
        projectName: targetPid ? (projectMap.get(String(targetPid))?.name || '') : 'All Projects',
        currency: curr,
        totalActiveWorkers: teamWorkers.length,
        totalUnsettledPayrollDebt: roundCurrency(totalUnsettledNetDue, curr),
        totalPeriodDays,
        totalPeriodOvertimeHours: Number(totalPeriodOt.toFixed(2)),
        totalPeriodGrossPay: roundCurrency(totalPeriodGross, curr),
        workers: rows.slice(0, limit)
      };
    }

    // ------------------------------------------------------------------
    // 5. get_worker_payments_and_loans
    // ------------------------------------------------------------------
    if (toolName === 'get_worker_payments_and_loans') {
      if (permissions.canFinancials === false) return { error: 'ACCESS_DENIED' };
      const [allWorkers, allPayments, allLoans] = await Promise.all([
        db.workers ? db.workers.toArray() : [],
        db.payments ? db.payments.toArray() : [],
        db.loans ? db.loans.toArray() : []
      ]);

      const workerMap = new Map(allWorkers.map((w) => [String(w.id), w]));
      const targetPid = resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId);
      const curr = getCurrencyForProject(targetPid);

      let targetWorkerIds = null;
      if (args.worker_id) {
        targetWorkerIds = new Set([String(args.worker_id)]);
      } else if (args.worker_name) {
        const matched = matchWorkerByQuery(allWorkers.filter((w) => !w.deletedAt), args.worker_name);
        targetWorkerIds = new Set(matched.map((w) => String(w.id)));
      }

      let payments = allPayments.filter((p) => {
        if (p.deletedAt || p.status === 'deleted') return false;
        if (targetWorkerIds && !targetWorkerIds.has(String(p.workerId))) return false;
        if (!targetWorkerIds && !isRecordInProjects(p.projectId, targetPid, allowedProjectIdsSet)) return false;
        return true;
      });

      if (args.month_key || args.start_date || args.end_date) {
        payments = filterByDateRange(payments, (p) => p.date || p.createdAt?.slice(0, 10), args.start_date, args.end_date, args.month_key, calendarType, language);
      }

      if (args.type === 'advance') {
        payments = payments.filter((p) => p.type !== 'settlement' && p.type !== 'Settlement' && p.status !== 'settled');
      } else if (args.type === 'settlement') {
        payments = payments.filter((p) => p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled');
      }

      payments.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));

      const loans = allLoans.filter((ln) => {
        if (ln.deletedAt || ln.status === 'deleted') return false;
        if (targetWorkerIds && !targetWorkerIds.has(String(ln.workerId))) return false;
        if (!targetWorkerIds && !isRecordInProjects(ln.projectId, targetPid, allowedProjectIdsSet)) return false;
        return true;
      });

      const totalAdvances = payments
        .filter((p) => p.type !== 'settlement' && p.type !== 'Settlement' && p.status !== 'settled')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalSettlements = payments
        .filter((p) => p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalRemainingLoans = loans
        .filter((ln) => ln.status !== 'paid_off')
        .reduce((s, ln) => s + (Number(ln.remainingBalance) || 0), 0);

      return {
        currency: curr,
        paymentsCount: payments.length,
        totalAdvances: roundCurrency(totalAdvances, curr),
        totalSettlements: roundCurrency(totalSettlements, curr),
        activeLoansCount: loans.filter((ln) => ln.status !== 'paid_off' && Number(ln.remainingBalance) > 0).length,
        totalRemainingLoanBalance: roundCurrency(totalRemainingLoans, curr),
        recentPayments: payments.slice(0, 25).map((p) => ({
          workerName: workerMap.get(String(p.workerId))?.name || p.workerName || '',
          type: p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled' ? 'settlement' : 'advance',
          date: fmtDate(p.date || p.createdAt?.slice(0, 10), language, calendarType),
          amount: roundCurrency(p.amount, p.currency || curr),
          note: p.note || p.description || ''
        })),
        loans: loans.slice(0, 20).map((ln) => ({
          workerName: workerMap.get(String(ln.workerId))?.name || '',
          principalAmount: roundCurrency(ln.principalAmount, curr),
          remainingBalance: roundCurrency(ln.remainingBalance, curr),
          monthlyInstallment: roundCurrency(ln.monthlyInstallment, curr),
          status: ln.status
        }))
      };
    }

    // ------------------------------------------------------------------
    // 6. get_expenses_summary
    // ------------------------------------------------------------------
    if (toolName === 'get_expenses_summary') {
      if (permissions.canExpenses === false) return { error: 'ACCESS_DENIED' };
      const [allExpenses, allCategories, allSections] = await Promise.all([
        db.expenses ? db.expenses.toArray() : [],
        db.expenseCategories ? db.expenseCategories.toArray() : [],
        db.projectSections ? db.projectSections.toArray() : []
      ]);

      const targetPid = resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId);
      const curr = getCurrencyForProject(targetPid);
      const catMap = new Map(allCategories.map((c) => [String(c.id), c.name]));
      const secMap = new Map(allSections.map((s) => [String(s.id), s.name]));

      let list = allExpenses.filter((e) => {
        if (e.deletedAt || e.isArchived) return false;
        return isRecordInProjects(e.projectId, targetPid, allowedProjectIdsSet);
      });

      if (args.month_key || args.start_date || args.end_date) {
        list = filterByDateRange(list, (e) => e.expenseDate || e.date || e.createdAt?.slice(0, 10), args.start_date, args.end_date, args.month_key, calendarType, language);
      }

      if (args.payment_status && args.payment_status !== 'all') {
        if (args.payment_status === 'paid') {
          list = list.filter((e) => e.paymentStatus === 'paid' || !e.paymentStatus);
        } else if (args.payment_status === 'unpaid') {
          list = list.filter((e) => e.paymentStatus === 'unpaid' || e.paymentStatus === 'pending' || e.paymentStatus === 'credit');
        }
      }

      if (args.category_query) {
        const cq = normalizeSearchText(args.category_query);
        list = list.filter((e) => normalizeSearchText(catMap.get(String(e.categoryId)) || '').includes(cq));
      }

      if (args.query) {
        const q = normalizeSearchText(args.query);
        list = list.filter((e) => {
          const hay = normalizeSearchText(`${e.title || ''} ${e.description || ''} ${e.personName || ''} ${catMap.get(String(e.categoryId)) || ''}`);
          return hay.includes(q);
        });
      }

      list.sort((a, b) => (b.expenseDate || b.createdAt || '').localeCompare(a.expenseDate || a.createdAt || ''));

      let totalAmount = 0;
      let paidTotal = 0;
      let unpaidTotal = 0;
      const byCategory = {};

      for (const e of list) {
        const amt = Number(e.amount) || 0;
        totalAmount += amt;
        if (e.paymentStatus === 'unpaid' || e.paymentStatus === 'pending' || e.paymentStatus === 'credit') {
          unpaidTotal += amt;
        } else {
          paidTotal += amt;
        }
        const cName = catMap.get(String(e.categoryId)) || 'دسته‌بندی نشده';
        byCategory[cName] = (byCategory[cName] || 0) + amt;
      }

      const categoryBreakdown = Object.entries(byCategory)
        .map(([name, total]) => ({ name, total: roundCurrency(total, curr) }))
        .sort((a, b) => b.total - a.total);

      return {
        projectName: targetPid ? (projectMap.get(String(targetPid))?.name || '') : 'All Projects',
        currency: curr,
        totalCount: list.length,
        totalAmount: roundCurrency(totalAmount, curr),
        paidTotal: roundCurrency(paidTotal, curr),
        unpaidTotal: roundCurrency(unpaidTotal, curr),
        categoryBreakdown: categoryBreakdown.slice(0, 15),
        recentExpenses: list.slice(0, 25).map((e) => ({
          date: fmtDate(e.expenseDate || e.date || e.createdAt?.slice(0, 10), language, calendarType),
          title: e.title,
          amount: roundCurrency(e.amount, e.currency || curr),
          category: catMap.get(String(e.categoryId)) || '',
          section: e.sectionId ? (secMap.get(String(e.sectionId)) || '') : '',
          payee: e.personName || '',
          paymentStatus: e.paymentStatus || 'paid',
          paymentMethod: e.paymentMethod || 'cash'
        }))
      };
    }

    // ------------------------------------------------------------------
    // 7. get_accounts_and_cashflow
    // ------------------------------------------------------------------
    if (toolName === 'get_accounts_and_cashflow') {
      if (permissions.canAccounting === false) return { error: 'ACCESS_DENIED' };
      const [allAccounts, allIncomes, allPayments, allExpenses, allTransfers] = await Promise.all([
        db.financialAccounts ? db.financialAccounts.toArray() : [],
        db.treasuryIncomes ? db.treasuryIncomes.toArray() : [],
        db.payments ? db.payments.toArray() : [],
        db.expenses ? db.expenses.toArray() : [],
        db.accountTransfers ? db.accountTransfers.toArray() : []
      ]);

      const targetPid = resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId);
      const curr = getCurrencyForProject(targetPid);

      const accounts = allAccounts.filter((a) => {
        if (a.deletedAt || a.status === 'deleted' || a.isActive === false) return false;
        if (a.isGlobal || a.scope === 'global') return true;
        return isRecordInProjects(a.projectId, targetPid, allowedProjectIdsSet);
      });

      const defaultCashId = accounts.find((a) => a.type === 'cash' && a.isDefault)?.id || accounts.find((a) => a.type === 'cash')?.id || 'acc_default_cash';
      const defaultBankId = accounts.find((a) => a.type === 'bank' && a.isDefault)?.id || accounts.find((a) => a.type === 'bank')?.id || 'acc_default_bank';

      const accStats = new Map();
      for (const a of accounts) {
        accStats.set(String(a.id), {
          id: a.id,
          name: a.name,
          type: a.type || 'cash',
          initialBalance: Number(a.initialBalance) || 0,
          inflow: 0,
          outflow: 0
        });
      }

      const validIncomes = allIncomes.filter((i) => !i.deletedAt && i.status !== 'deleted' && isRecordInProjects(i.projectId, targetPid, allowedProjectIdsSet));
      const validPayments = allPayments.filter((p) => !p.deletedAt && p.status !== 'deleted' && isRecordInProjects(p.projectId, targetPid, allowedProjectIdsSet));
      const validExpenses = allExpenses.filter((e) => !e.deletedAt && !e.isArchived && (e.paymentStatus === 'paid' || !e.paymentStatus) && isRecordInProjects(e.projectId, targetPid, allowedProjectIdsSet));
      const validTransfers = allTransfers.filter((t) => !t.deletedAt && t.status !== 'deleted' && isRecordInProjects(t.projectId, targetPid, allowedProjectIdsSet));

      for (const inc of validIncomes) {
        const tid = String(inc.accountId || (inc.accountType === 'bank' ? defaultBankId : defaultCashId));
        if (accStats.has(tid)) accStats.get(tid).inflow += Number(inc.amount) || 0;
      }
      for (const p of validPayments) {
        const tid = String(p.accountId || (p.paymentMethod === 'bank' || p.accountType === 'bank' ? defaultBankId : defaultCashId));
        if (accStats.has(tid)) accStats.get(tid).outflow += Number(p.amount) || 0;
      }
      for (const e of validExpenses) {
        const tid = String(e.accountId || (e.paymentMethod === 'bank' ? defaultBankId : defaultCashId));
        if (accStats.has(tid)) accStats.get(tid).outflow += Number(e.amount) || 0;
      }
      for (const trf of validTransfers) {
        const amt = Number(trf.amount) || 0;
        if (trf.fromAccountId && accStats.has(String(trf.fromAccountId))) accStats.get(String(trf.fromAccountId)).outflow += amt;
        if (trf.toAccountId && accStats.has(String(trf.toAccountId))) accStats.get(String(trf.toAccountId)).inflow += amt;
      }

      const accountSummaries = Array.from(accStats.values()).map((a) => ({
        name: a.name,
        type: a.type,
        initialBalance: roundCurrency(a.initialBalance, curr),
        totalInflow: roundCurrency(a.inflow, curr),
        totalOutflow: roundCurrency(a.outflow, curr),
        currentBalance: roundCurrency(a.initialBalance + a.inflow - a.outflow, curr)
      }));

      // Period cashflow if requested
      const hasPeriod = Boolean(args.month_key || args.start_date || args.end_date);
      const pIncomes = hasPeriod ? filterByDateRange(validIncomes, (i) => i.date || i.createdAt?.slice(0, 10), args.start_date, args.end_date, args.month_key, calendarType, language) : validIncomes;
      const pPayments = hasPeriod ? filterByDateRange(validPayments, (p) => p.date || p.createdAt?.slice(0, 10), args.start_date, args.end_date, args.month_key, calendarType, language) : validPayments;
      const pExpenses = hasPeriod ? filterByDateRange(validExpenses, (e) => e.expenseDate || e.date || e.createdAt?.slice(0, 10), args.start_date, args.end_date, args.month_key, calendarType, language) : validExpenses;

      const periodIncomeTotal = pIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const periodPayrollOut = pPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const periodExpenseOut = pExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const totalCurrentCashAndBank = accountSummaries.reduce((s, a) => s + a.currentBalance, 0);

      return {
        projectName: targetPid ? (projectMap.get(String(targetPid))?.name || '') : 'All Projects',
        currency: curr,
        totalCurrentBalanceAllAccounts: roundCurrency(totalCurrentCashAndBank, curr),
        accounts: accountSummaries,
        cashflowPeriod: hasPeriod ? (args.month_key || `${args.start_date || ''}..${args.end_date || ''}`) : 'all_time',
        totalIncomes: roundCurrency(periodIncomeTotal, curr),
        totalPayrollPaid: roundCurrency(periodPayrollOut, curr),
        totalExpensesPaid: roundCurrency(periodExpenseOut, curr),
        netCashflow: roundCurrency(periodIncomeTotal - periodPayrollOut - periodExpenseOut, curr)
      };
    }

    // ------------------------------------------------------------------
    // 8. get_contracts_and_cheques
    // ------------------------------------------------------------------
    if (toolName === 'get_contracts_and_cheques') {
      if (permissions.canAccounting === false) return { error: 'ACCESS_DENIED' };
      const [allContracts, allCheques, allCounterparties] = await Promise.all([
        db.contracts ? db.contracts.toArray() : [],
        db.cheques ? db.cheques.toArray() : [],
        db.counterparties ? db.counterparties.toArray() : []
      ]);

      const targetPid = resolveTargetProjectId(null, args.project_name, allowedProjects, activeProjectId);
      const curr = getCurrencyForProject(targetPid);
      const cpMap = new Map(allCounterparties.map((c) => [String(c.id), c.name]));
      const todayIso = getTodayDateString();
      const q = normalizeSearchText(args.query || '');
      const focus = args.focus || 'all';
      const result = {
        projectName: targetPid ? (projectMap.get(String(targetPid))?.name || '') : 'All Projects',
        currency: curr
      };

      if (focus === 'all' || focus === 'contracts') {
        let contracts = allContracts.filter(
          (c) => !c.deletedAt && !c.isArchived && c.status !== 'deleted' && isRecordInProjects(c.projectId, targetPid, allowedProjectIdsSet)
        );
        if (q) {
          contracts = contracts.filter((c) =>
            normalizeSearchText(`${c.title || ''} ${c.contractNumber || ''} ${cpMap.get(String(c.counterpartyId)) || c.counterpartyName || ''}`).includes(q)
          );
        }
        if (args.status) {
          contracts = contracts.filter((c) => String(c.status) === String(args.status));
        }
        result.contractsSummary = {
          count: contracts.length,
          totalEstimatedValue: roundCurrency(contracts.reduce((s, c) => s + (Number(c.totalEstimatedAmount) || 0), 0), curr),
          items: contracts.slice(0, 20).map((c) => ({
            contractNumber: c.contractNumber || '',
            title: c.title,
            contractor: cpMap.get(String(c.counterpartyId)) || c.counterpartyName || '',
            status: c.status || 'active',
            startDate: fmtDate(c.startDate, language, calendarType),
            estimatedEndDate: fmtDate(c.estimatedEndDate, language, calendarType),
            totalEstimatedAmount: roundCurrency(c.totalEstimatedAmount, curr),
            finalPayableAmount: c.finalPayableAmount != null ? roundCurrency(c.finalPayableAmount, curr) : null
          }))
        };
      }

      if (focus === 'all' || focus === 'cheques') {
        let cheques = allCheques.filter(
          (ch) => !ch.deletedAt && ch.status !== 'deleted' && isRecordInProjects(ch.projectId, targetPid, allowedProjectIdsSet)
        );
        if (q) {
          cheques = cheques.filter((ch) =>
            normalizeSearchText(`${ch.chequeNumber || ''} ${ch.sayadNumber || ''} ${ch.bankName || ''} ${cpMap.get(String(ch.counterpartyId)) || ch.payeeName || ''}`).includes(q)
          );
        }
        if (args.status === 'overdue') {
          cheques = cheques.filter((ch) => (ch.status === 'in_hand' || ch.status === 'issued') && ch.dueDate && ch.dueDate < todayIso);
        } else if (args.status) {
          cheques = cheques.filter((ch) => String(ch.status) === String(args.status));
        }
        cheques.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

        const overdueCount = cheques.filter((ch) => (ch.status === 'in_hand' || ch.status === 'issued') && ch.dueDate && ch.dueDate < todayIso).length;
        const outwardPending = cheques.filter((ch) => ch.type === 'outward' && ch.status !== 'cleared' && ch.status !== 'cancelled').reduce((s, ch) => s + (Number(ch.amount) || 0), 0);
        const inwardPending = cheques.filter((ch) => ch.type === 'inward' && ch.status !== 'cleared' && ch.status !== 'cancelled').reduce((s, ch) => s + (Number(ch.amount) || 0), 0);

        result.chequesSummary = {
          count: cheques.length,
          overdueCount,
          pendingOutwardTotal: roundCurrency(outwardPending, curr),
          pendingInwardTotal: roundCurrency(inwardPending, curr),
          items: cheques.slice(0, 25).map((ch) => ({
            chequeNumber: ch.chequeNumber || '',
            type: ch.type || 'outward',
            status: ch.status || 'issued',
            amount: roundCurrency(ch.amount, curr),
            dueDate: fmtDate(ch.dueDate, language, calendarType),
            isOverdue: Boolean((ch.status === 'in_hand' || ch.status === 'issued') && ch.dueDate && ch.dueDate < todayIso),
            bankName: ch.bankName || '',
            counterparty: cpMap.get(String(ch.counterpartyId)) || ch.payeeName || ''
          }))
        };
      }

      if (focus === 'counterparties') {
        let cps = allCounterparties.filter((c) => !c.deletedAt && c.status !== 'deleted' && isRecordInProjects(c.projectId, targetPid, allowedProjectIdsSet));
        if (q) cps = cps.filter((c) => normalizeSearchText(`${c.name || ''} ${c.phone || ''} ${c.type || ''}`).includes(q));
        result.counterparties = cps.slice(0, 30).map((c) => ({
          name: c.name,
          type: c.type || '',
          phone: c.phone || ''
        }));
      }

      return result;
    }

    return { error: `Unknown tool: ${toolName}` };
  } catch (err) {
    console.error(`[AI DB Tool Error: ${toolName}]`, err);
    return { error: err?.message || 'Database query error' };
  }
}
