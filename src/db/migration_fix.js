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
    console.log('Emergency cleanup finished, deleted:', deletedCount);
    if (deletedCount > 0) {
      window.location.reload();
    }
  } catch (err) {
    console.error('Cleanup failed', err);
  }
}
