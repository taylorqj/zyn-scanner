import { browser } from 'wxt/browser';
import type { WxtStorageItem } from 'wxt/utils/storage';
import { REWARDS_URL } from '@/features/rewards-page/rewardsPage';
import type { RedeemCommand, RedeemCommandResponse } from './messages';
import type { CanRepository, StateStore, TabDriver, Watchdog } from './ports';
import type { CanRecord } from './types';

export const WATCHDOG_ALARM = 'redemption-watchdog';

export function storageStateStore<T>(
  item: WxtStorageItem<T, Record<string, unknown>>,
): StateStore<T> {
  return {
    get: () => item.getValue(),
    set: (value) => item.setValue(value),
  };
}

/** Only the background service worker writes cans, one operation at a time, so read-modify-write is safe. */
export class StorageCanRepository implements CanRepository {
  constructor(
    private readonly item: WxtStorageItem<Record<string, CanRecord>, Record<string, unknown>>,
  ) {}

  async getAll(): Promise<CanRecord[]> {
    return Object.values(await this.item.getValue());
  }

  async get(code: string): Promise<CanRecord | undefined> {
    return (await this.item.getValue())[code];
  }

  save(record: CanRecord): Promise<void> {
    return this.saveMany([record]);
  }

  async saveMany(records: CanRecord[]): Promise<void> {
    const cans = { ...(await this.item.getValue()) };
    for (const record of records) cans[record.code] = record;
    await this.item.setValue(cans);
  }

  async remove(code: string): Promise<void> {
    const { [code]: _removed, ...rest } = await this.item.getValue();
    await this.item.setValue(rest);
  }
}

export class BrowserTabDriver implements TabDriver {
  async openWorker(): Promise<number> {
    const tab = await browser.tabs.create({ url: REWARDS_URL, active: false });
    if (tab.id === undefined) throw new Error('Chrome did not return an id for the Zyn tab.');
    return tab.id;
  }

  async close(tabId: number): Promise<void> {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }

  async focus(tabId: number): Promise<void> {
    try {
      const tab = await browser.tabs.update(tabId, { active: true });
      if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
    } catch {
      // The tab was closed in the meantime; tabs.onRemoved handles the bookkeeping.
    }
  }

  async isAlive(tabId: number): Promise<boolean> {
    try {
      const tab = await browser.tabs.get(tabId);
      return !tab.discarded;
    } catch {
      return false;
    }
  }

  async sendRedeem(tabId: number, code: string): Promise<boolean> {
    const command: RedeemCommand = { type: 'worker/redeem', code };
    try {
      const response: RedeemCommandResponse | undefined = await browser.tabs.sendMessage(
        tabId,
        command,
      );
      return response?.accepted === true;
    } catch {
      return false;
    }
  }
}

export class AlarmWatchdog implements Watchdog {
  async arm(delayMs: number): Promise<void> {
    await browser.alarms.create(WATCHDOG_ALARM, { when: Date.now() + delayMs });
  }

  async disarm(): Promise<void> {
    await browser.alarms.clear(WATCHDOG_ALARM);
  }
}
