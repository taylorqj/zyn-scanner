import {
  cansItem,
  monthlyUsageItem,
  queueStateItem,
  trustedHostsItem,
} from '@/lib/storageItems';
import {
  AlarmWatchdog,
  BrowserTabDriver,
  StorageCanRepository,
  storageStateStore,
} from './browserAdapters';
import { RedemptionService } from './redemptionService';

/** Breathing room between two codes, so the queue runs at about the pace of someone typing them in. */
const PAUSE_BETWEEN_CODES_MS = 1_500;

export function createRedemptionService(): RedemptionService {
  return new RedemptionService({
    cans: new StorageCanRepository(cansItem),
    queueState: storageStateStore(queueStateItem),
    usage: storageStateStore(monthlyUsageItem),
    trustedHosts: storageStateStore(trustedHostsItem),
    tabs: new BrowserTabDriver(),
    watchdog: new AlarmWatchdog(),
    now: () => Date.now(),
    scheduleNext: (task) => setTimeout(task, PAUSE_BETWEEN_CODES_MS),
  });
}
