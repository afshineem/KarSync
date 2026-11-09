import { DEFAULT_PROJECT_ID } from '../db/db';

/**
 * Checks whether a given worker belongs to or is active within the target project.
 *
 * Rules:
 * 1. Global / Permanent company staff (isGlobal === true or scope === 'global')
 *    are universally active in all projects (past, present, and future).
 * 2. Custom multi-project assigned workers (scope === 'custom') are active in assignedProjectIds.
 * 3. Project-specific workers (default) are strictly confined to their origin projectId.
 *
 * @param {Object} worker The worker entity from db.workers
 * @param {string} targetProjectId The ID of the currently active project
 * @returns {boolean} True if the worker is assigned/active in this project
 */
export function isWorkerInProject(worker, targetProjectId) {
  if (!worker || !targetProjectId) return false;

  // 1. Permanent company staff (Global)
  if (worker.isGlobal === true || worker.isGlobal === 1 || worker.scope === 'global') {
    return true;
  }

  // 2. Custom multi-project assignment
  if (worker.scope === 'custom' && Array.isArray(worker.assignedProjectIds)) {
    return worker.assignedProjectIds.includes(targetProjectId);
  }

  // 3. Project-specific (safe default)
  const workerPid = worker.projectId || DEFAULT_PROJECT_ID;
  return workerPid === targetProjectId;
}

/**
 * Resolves project-specific wage rates for a worker.
 * If project-specific custom rates exist, they take precedence;
 * otherwise, defaults to the worker's base profile rates.
 *
 * @param {Object} worker The worker entity
 * @param {string} [projectId] Target project ID
 * @returns {{ dailyRate: number, overtimeHourlyRate: number, monthlySalary: number }}
 */
export function getWorkerRatesForProject(worker, projectId) {
  if (!worker) {
    return { dailyRate: 0, overtimeHourlyRate: 0, monthlySalary: 0 };
  }

  const baseDaily = Number(worker.dailyRate) || 0;
  const baseOvertime = Number(worker.overtimeHourlyRate) || 0;
  const baseMonthly = Number(worker.monthlySalary) || 0;

  if (projectId && worker.projectRates && typeof worker.projectRates === 'object') {
    const custom = worker.projectRates[projectId];
    if (custom) {
      return {
        dailyRate: custom.dailyRate !== undefined && custom.dailyRate !== '' ? Number(custom.dailyRate) : baseDaily,
        overtimeHourlyRate: custom.overtimeHourlyRate !== undefined && custom.overtimeHourlyRate !== '' ? Number(custom.overtimeHourlyRate) : baseOvertime,
        monthlySalary: custom.monthlySalary !== undefined && custom.monthlySalary !== '' ? Number(custom.monthlySalary) : baseMonthly
      };
    }
  }

  return {
    dailyRate: baseDaily,
    overtimeHourlyRate: baseOvertime,
    monthlySalary: baseMonthly
  };
}
