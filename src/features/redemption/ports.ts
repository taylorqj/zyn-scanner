import type { CanRecord } from './types';

export interface CanRepository {
  getAll(): Promise<CanRecord[]>;
  get(code: string): Promise<CanRecord | undefined>;
  save(record: CanRecord): Promise<void>;
  saveMany(records: CanRecord[]): Promise<void>;
  remove(code: string): Promise<void>;
}

export interface StateStore<T> {
  get(): Promise<T>;
  set(value: T): Promise<void>;
}

/** Controls browser tabs on behalf of the redemption queue. */
export interface TabDriver {
  /** Opens the Zyn rewards page in a background tab and returns its tab id. */
  openWorker(): Promise<number>;
  close(tabId: number): Promise<void>;
  focus(tabId: number): Promise<void>;
  isAlive(tabId: number): Promise<boolean>;
  /** Asks the worker tab to redeem a code. Resolves false when the tab is not listening. */
  sendRedeem(tabId: number, code: string): Promise<boolean>;
}

/** A single re-armable timer that survives the service worker being suspended. */
export interface Watchdog {
  arm(delayMs: number): Promise<void>;
  disarm(): Promise<void>;
}
