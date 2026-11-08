import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { pullContractsLive } from '../services/realtimeSync';

/**
 * useContracts hook
 * Real-time reactive query for construction contracts, contractor progress, and measurement stats.
 */
export function useContracts() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const currency = currentProject?.currency || 'IQD';

  const [syncTick, setSyncTick] = useState(0);

  // Sync listener & initial fetch
  useEffect(() => {
    const handleSync = () => setSyncTick((t) => t + 1);
    window.addEventListener('workshop-contracts-sync', handleSync);
    pullContractsLive().catch(console.warn);

    return () => {
      window.removeEventListener('workshop-contracts-sync', handleSync);
    };
  }, []);

  // Live Query: Counterparties map for fast name lookup
  const counterparties = useLiveQuery(
    async () => {
      if (!db.counterparties) return [];
      const list = await db.counterparties.toArray();
      return list.filter((cp) => !cp.deletedAt && (!cp.projectId || cp.projectId === projectId || projectId === DEFAULT_PROJECT_ID));
    },
    [projectId, syncTick]
  ) || [];

  const counterpartyMap = useMemo(() => {
    const map = new Map();
    counterparties.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [counterparties]);

  // Live Query: Contracts
  const rawContracts = useLiveQuery(
    async () => {
      if (!db.contracts) return [];
      const list = await db.contracts.toArray();
      return list
        .filter((c) => !c.deletedAt && c.status !== 'deleted' && (!c.projectId || c.projectId === projectId || projectId === DEFAULT_PROJECT_ID))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // Enriched contracts with counterparty metadata
  const contracts = useMemo(() => {
    return rawContracts.map((ctr) => {
      const cp = counterpartyMap.get(String(ctr.counterpartyId));
      return {
        ...ctr,
        counterpartyName: cp?.name || ctr.counterpartyName || 'نامشخص',
        counterpartyPhone: cp?.phone || '',
        counterpartyType: cp?.type || ctr.type
      };
    });
  }, [rawContracts, counterpartyMap]);

  // Live Stats
  const contractStats = useMemo(() => {
    let totalEstimatedValue = 0;
    let totalFinalValue = 0;
    let activeCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let completedCount = 0;
    let overdueCount = 0;
    let totalDelayPenalties = 0;
    const today = new Date().toISOString().slice(0, 10);

    contracts.forEach((c) => {
      const estAmt = Number(c.totalEstimatedAmount) || 0;
      totalEstimatedValue += estAmt;

      if (c.status === 'completed') {
        completedCount++;
        totalFinalValue += Number(c.finalPayableAmount !== null ? c.finalPayableAmount : estAmt) || 0;
      } else if (c.status === 'draft' || (c.status === 'active' && c.startDate && c.startDate > today)) {
        notStartedCount++;
      } else if (c.status === 'active') {
        activeCount++;
        if (c.estimatedEndDate && c.estimatedEndDate < today) {
          overdueCount++;
          // Calculate penalty
          const dDiff = Math.ceil((new Date(today) - new Date(c.estimatedEndDate)) / (1000 * 60 * 60 * 24));
          totalDelayPenalties += Math.max(0, dDiff) * (Number(c.delayPenaltyPerDay) || 0);
        } else {
          inProgressCount++;
        }
      }
    });

    return {
      totalEstimatedValue,
      totalFinalValue,
      activeCount: activeCount + notStartedCount,
      inProgressCount,
      notStartedCount,
      completedCount,
      overdueCount,
      totalDelayPenalties,
      totalCount: contracts.length
    };
  }, [contracts]);

  return {
    contracts,
    counterparties,
    counterpartyMap,
    contractStats,
    currency,
    projectId
  };
}
