import type { CanRepository, StateStore, TabDriver, Watchdog } from '../ports';
import type { CanRecord } from '../types';

export class InMemoryCanRepository implements CanRepository {
  private readonly records = new Map<string, CanRecord>();

  async getAll(): Promise<CanRecord[]> {
    return [...this.records.values()];
  }

  async get(code: string): Promise<CanRecord | undefined> {
    return this.records.get(code);
  }

  async save(record: CanRecord): Promise<void> {
    this.records.set(record.code, record);
  }

  async saveMany(records: CanRecord[]): Promise<void> {
    for (const record of records) this.records.set(record.code, record);
  }

  async remove(code: string): Promise<void> {
    this.records.delete(code);
  }
}

export class MemoryStore<T> implements StateStore<T> {
  constructor(public value: T) {}

  async get(): Promise<T> {
    return this.value;
  }

  async set(value: T): Promise<void> {
    this.value = value;
  }
}

export class FakeTabDriver implements TabDriver {
  opened: number[] = [];
  closed: number[] = [];
  focused: number[] = [];
  redeemRequests: { tabId: number; code: string }[] = [];
  /** Set to false to simulate a worker tab whose content script is gone. */
  delivers = true;
  private nextTabId = 100;

  async openWorker(): Promise<number> {
    const tabId = this.nextTabId++;
    this.opened.push(tabId);
    return tabId;
  }

  async close(tabId: number): Promise<void> {
    this.closed.push(tabId);
  }

  async focus(tabId: number): Promise<void> {
    this.focused.push(tabId);
  }

  async isAlive(tabId: number): Promise<boolean> {
    return this.opened.includes(tabId) && !this.closed.includes(tabId);
  }

  async sendRedeem(tabId: number, code: string): Promise<boolean> {
    if (!this.delivers) return false;
    this.redeemRequests.push({ tabId, code });
    return true;
  }
}

export class FakeWatchdog implements Watchdog {
  armedForMs: number | null = null;

  async arm(delayMs: number): Promise<void> {
    this.armedForMs = delayMs;
  }

  async disarm(): Promise<void> {
    this.armedForMs = null;
  }
}
