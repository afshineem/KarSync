import { db } from './db.js';
import { pushPaymentsLive } from '../services/realtimeSync.js';

export async function runEmergencyCleanup() {
  try {
    const hasRun = localStorage.getItem('emergency_cleanup_04');
    if (hasRun) return;

    let deletedCount = 0;

    // 1. Delete bad group settlements
    const groups = await db.groups.toArray();
    const badGroupIds = groups
      .filter(g => g.name.includes('کونکریت') || g.name.includes('راویژ') || g.name.includes('زرگار') || g.name.includes('Concrete') || g.name.includes('Raveezh') || g.name.includes('Zargar'))
      .map(g => g.id);

    if (badGroupIds.length > 0) {
      const allPayments = await db.payments.toArray();
      for (const p of allPayments) {
        if (badGroupIds.includes(p.groupId) && (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')) {
          await db.payments.update(p.id, { deletedAt: new Date().toISOString(), status: 'deleted' });
          deletedCount++;
        }
      }
    }

    // 2. Delete Ramin's phantom advances (user said he has NO advances at all)
    const workers = await db.workers.toArray();
    const ramin = workers.find(w => w.name.includes('رامین') || w.name.includes('Ramin'));
    if (ramin) {
      const raminPayments = await db.payments.where('workerId').equals(ramin.id).toArray();
      for (const p of raminPayments) {
        if (p.type === 'advance' || p.type === 'Advance_Payment') {
          await db.payments.update(p.id, { deletedAt: new Date().toISOString(), status: 'deleted' });
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      await pushPaymentsLive().catch(() => {});
    }

    localStorage.setItem('emergency_cleanup_04', 'done');

    // 3. Fix falsely settled attendance logs after settlement date (e.g. Ramin on 2026-09-22, Afshin on 2026-10-01)
    const hasRun06 = localStorage.getItem('emergency_cleanup_06');
    if (!hasRun06) {
      const allPayments = await db.payments.toArray();
      const activeSettlements = allPayments.filter(
        (p) => !p.deletedAt && p.status !== 'deleted' && (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
      );

      const allWorkers = await db.workers.toArray();
      let logsToReset = [];

      for (const w of allWorkers) {
        const wIdStr = String(w.id);
        const isAfshin = wIdStr.includes('phobsou') || (w.name && w.name.includes('ئەفشین'));
        const isRamin = wIdStr.includes('1nkmm5i') || (w.name && w.name.includes('رامین'));

        const workerSettlements = activeSettlements.filter(
          (p) => String(p.workerId) === wIdStr || (w.groupId && p.groupId === w.groupId)
        );
        const sortedSt = [...workerSettlements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const lastStDate = sortedSt[0]?.date || sortedSt[0]?.createdAt?.slice(0, 10) || null;

        const workerLogs = await db.attendanceLogs.where('workerId').equals(wIdStr).toArray();
        for (const log of workerLogs) {
          let shouldReset = false;

          // 1. Logs worked strictly after the settlement date
          if (lastStDate && log.date && log.date > lastStDate) {
            shouldReset = true;
          }

          // 2. Afshin specific: 2026-10-01 was October work, NOT covered by September settlement
          if (isAfshin && log.date && log.date >= '2026-10-01') {
            shouldReset = true;
          }

          // 3. Ramin specific: 2026-09-22 was worked after the 2026-09-20 settlement
          if (isRamin && log.date && log.date >= '2026-09-22') {
            shouldReset = true;
          }

          // 4. Any log without settlements that was somehow marked settled
          if (!lastStDate && (log.isSettled || log.settlementReceiptId)) {
            shouldReset = true;
          }

          if (shouldReset) {
            let cleanNotes = log.notes || '';
            let needsUpdate = false;

            if (log.isSettled || log.settlementReceiptId) {
              needsUpdate = true;
            }

            if (cleanNotes.includes('"st":1') || cleanNotes.includes('"st": 1')) {
              cleanNotes = cleanNotes.replace(/"st":\s*1,?/g, '').replace(/,"rid":\s*"[^"]*"/g, '').replace(/"rid":\s*"[^"]*",?/g, '');
              needsUpdate = true;
            }

            if (needsUpdate) {
              logsToReset.push({
                ...log,
                isSettled: false,
                settlementReceiptId: null,
                notes: cleanNotes,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
      }

      if (logsToReset.length > 0) {
        await db.attendanceLogs.bulkPut(logsToReset);
        const { pushLogsLive } = await import('../services/realtimeSync.js');
        await pushLogsLive(logsToReset).catch(() => {});
        console.log('Emergency cleanup 06: Reset falsely settled logs count:', logsToReset.length);
      }

      localStorage.setItem('emergency_cleanup_06', 'done');
      if (logsToReset.length > 0) {
        window.location.reload();
      }
    }

    // 4. Emergency Cleanup 08: Universal Settlement Period Alignment
    const hasRun08 = localStorage.getItem('emergency_cleanup_08');
    if (!hasRun08) {
      const { getReceiptPeriodEnd } = await import('../utils/settlementCalculations.js');
      const allPayments = await db.payments.toArray();
      const paymentsToUpdate = [];

      // A. Align Afshin's September settlement receipt
      for (const p of allPayments) {
        if (p.id === 'pay_muq06b1e_o79rv' || (p.date === '2026-10-01' && (p.notes?.includes('شهریور') || p.notes?.includes('30 روز') || p.notes?.includes('31 روز')))) {
          paymentsToUpdate.push({
            ...p,
            month: '2026-09',
            periodStartDate: '2026-09-01',
            periodEndDate: '2026-09-30',
            settlement_status: 'settled',
            remainingBalanceAfter: 0,
            notes: 'تسویه حساب کامل کارکرد شهریور (30 روز)',
            updatedAt: new Date().toISOString()
          });
        } else if ((p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') && !p.periodEndDate) {
          const derivedEnd = getReceiptPeriodEnd(p);
          if (derivedEnd) {
            paymentsToUpdate.push({
              ...p,
              periodEndDate: derivedEnd,
              periodStartDate: p.periodStartDate || (p.month ? `${p.month}-01` : null),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      if (paymentsToUpdate.length > 0) {
        await db.payments.bulkPut(paymentsToUpdate);
        await pushPaymentsLive().catch(() => {});
      }

      // B. Align attendance logs to period boundaries
      const refreshedPayments = await db.payments.toArray();
      const activeSettlements = refreshedPayments.filter(
        (p) => !p.deletedAt && p.status !== 'deleted' && (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
      );
      const receiptMap = new Map(activeSettlements.map((p) => [String(p.id), p]));

      const allLogs = await db.attendanceLogs.toArray();
      const logsToFix = [];

      for (const log of allLogs) {
        let shouldReset = false;

        if (log.settlementReceiptId) {
          const receipt = receiptMap.get(String(log.settlementReceiptId));
          if (!receipt) {
            shouldReset = true;
          } else {
            const periodEnd = getReceiptPeriodEnd(receipt);
            if (periodEnd && (log.date || '') > periodEnd) {
              shouldReset = true;
            }
          }
        } else if (log.isSettled) {
          const workerSettlements = activeSettlements.filter(
            (p) => String(p.workerId) === String(log.workerId)
          );
          if (workerSettlements.length === 0) {
            shouldReset = true;
          } else {
            const sortedSt = [...workerSettlements].sort((a, b) => {
              const endA = getReceiptPeriodEnd(a) || '';
              const endB = getReceiptPeriodEnd(b) || '';
              return endB.localeCompare(endA);
            });
            const lastPeriodEnd = getReceiptPeriodEnd(sortedSt[0]);
            if (lastPeriodEnd && (log.date || '') > lastPeriodEnd) {
              shouldReset = true;
            }
          }
        }

        if (shouldReset) {
          let cleanNotes = log.notes || '';
          if (cleanNotes.includes('"st":1') || cleanNotes.includes('"st": 1')) {
            cleanNotes = cleanNotes.replace(/"st":\s*1,?/g, '').replace(/,"rid":\s*"[^"]*"/g, '').replace(/"rid":\s*"[^"]*",?/g, '');
          }
          logsToFix.push({
            ...log,
            isSettled: false,
            settlementReceiptId: null,
            notes: cleanNotes,
            updatedAt: new Date().toISOString()
          });
        }
      }

      if (logsToFix.length > 0) {
        await db.attendanceLogs.bulkPut(logsToFix);
        const { pushLogsLive } = await import('../services/realtimeSync.js');
        await pushLogsLive(logsToFix).catch(() => {});
        console.log('Emergency cleanup 08: Fixed falsely settled logs count:', logsToFix.length);
      }

      localStorage.setItem('emergency_cleanup_08', 'done');
      if (logsToFix.length > 0 || paymentsToUpdate.length > 0) {
        window.location.reload();
      }
    }

    console.log('Emergency cleanup finished, deleted:', deletedCount);
  } catch (err) {
    console.error('Cleanup failed', err);
  }
}
