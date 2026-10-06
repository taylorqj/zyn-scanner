import { storage } from 'wxt/utils/storage';
import type { CanRecord, MonthlyUsage, QueueState } from '@/features/redemption/types';

/** Every scanned can, keyed by its code. */
export const cansItem = storage.defineItem<Record<string, CanRecord>>('local:cans', {
  fallback: {},
});

export const monthlyUsageItem = storage.defineItem<MonthlyUsage | null>('local:monthlyUsage', {
  fallback: null,
});

/** Non-zyn.com hosts the user confirmed their cans' QR codes point at. */
export const trustedHostsItem = storage.defineItem<string[]>('local:trustedHosts', {
  fallback: [],
});

export const INITIAL_QUEUE_STATE: QueueState = { workerStatus: 'closed' };

/** Tab ids and in-flight work only make sense for the current browser session. */
export const queueStateItem = storage.defineItem<QueueState>('session:queueState', {
  fallback: INITIAL_QUEUE_STATE,
});
