import { useMemo } from 'react';
import { useStorageItem } from '@/hooks/useStorageItem';
import {
  cansItem,
  INITIAL_QUEUE_STATE,
  monthlyUsageItem,
  queueStateItem,
} from '@/lib/storageItems';
import { emptyUsage, monthKey } from '../monthlyUsage';
import type { CanRecord, MonthlyUsage, QueueState } from '../types';

const NO_CANS: Record<string, CanRecord> = {};

/** Scanned cans, newest first. */
export function useCans(): CanRecord[] {
  const cans = useStorageItem(cansItem, NO_CANS);
  return useMemo(() => Object.values(cans).sort((a, b) => b.scannedAt - a.scannedAt), [cans]);
}

export function useQueueState(): QueueState {
  return useStorageItem(queueStateItem, INITIAL_QUEUE_STATE);
}

/** This month's usage; a stored value from an earlier month reads as a fresh month. */
export function useMonthlyUsage(): MonthlyUsage {
  const stored = useStorageItem(monthlyUsageItem, null);
  const now = Date.now();
  return stored?.month === monthKey(now) ? stored : emptyUsage(now);
}
