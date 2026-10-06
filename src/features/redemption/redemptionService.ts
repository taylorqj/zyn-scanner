import { parseScannedText } from './canCode';
import { emptyUsage, monthKey, withCapReached, withCreditedCode } from './monthlyUsage';
import type { CanRepository, StateStore, TabDriver, Watchdog } from './ports';
import type {
  CanRecord,
  CanStatus,
  MonthlyUsage,
  PageOutcome,
  QueuePause,
  QueueState,
  ScanResult,
  WorkerPageStatus,
} from './types';

export const REDEEM_WATCHDOG_MS = 45_000;
export const WORKER_LOAD_WATCHDOG_MS = 45_000;
const MAX_WORKER_FAILURES = 2;

export interface RedemptionDeps {
  cans: CanRepository;
  queueState: StateStore<QueueState>;
  usage: StateStore<MonthlyUsage | null>;
  trustedHosts: StateStore<string[]>;
  tabs: TabDriver;
  watchdog: Watchdog;
  now: () => number;
  /** Runs `task` after the pause between two redemptions. */
  scheduleNext: (task: () => void) => void;
}

/**
 * Owns the redemption queue: takes scanned codes, feeds them one at a time to the Zyn rewards tab
 * ("the worker tab") and records what Zyn answered.
 *
 * It runs in an MV3 service worker that can be suspended at any moment, so nothing important lives
 * in memory: every step reads and writes the stores, and progress is driven by events (a scan, a
 * message from the worker tab, a closed tab, the watchdog alarm).
 */
export class RedemptionService {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: RedemptionDeps) {}

  scannerOpened(tabId: number): Promise<void> {
    return this.exclusive(async () => {
      let state = await this.deps.queueState.get();
      if (state.workerTabId !== undefined && !(await this.deps.tabs.isAlive(state.workerTabId))) {
        state = await this.forgetWorker(state);
      }
      state = { ...state, scannerTabId: tabId };
      await this.deps.queueState.set(state);
      await this.requeueOrphans(state);
      await this.loadUsage();
      // Open the Zyn tab up front so a missing login shows up before the first can is scanned.
      if (state.workerTabId === undefined) await this.openWorker(state);
      await this.pumpLocked();
    });
  }

  submitScan(text: string, options: { trustHost?: boolean } = {}): Promise<ScanResult> {
    return this.exclusive(async () => {
      const trustedHosts = await this.deps.trustedHosts.get();
      const parsed = parseScannedText(text, trustedHosts);
      if (parsed.kind === 'not_a_code') return { kind: 'unrecognized' };
      if (parsed.kind === 'untrusted_host') {
        if (!options.trustHost) {
          return { kind: 'untrusted_host', host: parsed.host, code: parsed.code };
        }
        await this.deps.trustedHosts.set([...trustedHosts, parsed.host]);
      }

      const existing = await this.deps.cans.get(parsed.code);
      // Scanning a failed can again is the natural way to ask for another try.
      if (existing && existing.status !== 'failed') return { kind: 'duplicate', record: existing };

      const usage = await this.loadUsage();
      const now = this.deps.now();
      const record: CanRecord = {
        code: parsed.code,
        status: usage.capReached ? 'deferred' : 'queued',
        scannedAt: existing?.scannedAt ?? now,
        updatedAt: now,
        attempts: existing?.attempts ?? 0,
      };
      await this.deps.cans.save(record);
      await this.pumpLocked();
      return { kind: record.status === 'queued' ? 'queued' : 'deferred', record };
    });
  }

  /** Continues after a pause, giving the code that caused it another try. */
  resume(): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      if (!state.paused) return;
      const record = await this.deps.cans.get(state.paused.code);
      if (record?.status === 'failed') await this.saveWithStatus([record], 'queued');
      await this.deps.queueState.set({ ...state, paused: undefined });
      await this.pumpLocked();
    });
  }

  /** Tries the cans saved for next month right now; Zyn stays the judge of the limit. */
  retryDeferred(): Promise<void> {
    return this.exclusive(async () => {
      const usage = await this.loadUsage();
      await this.deps.usage.set({ ...usage, capReached: false });
      await this.requeue('deferred');
      await this.pumpLocked();
    });
  }

  retryCan(code: string): Promise<void> {
    return this.exclusive(async () => {
      const record = await this.deps.cans.get(code);
      if (!record || (record.status !== 'failed' && record.status !== 'rejected')) return;
      const usage = await this.loadUsage();
      await this.saveWithStatus([record], usage.capReached ? 'deferred' : 'queued');
      await this.pumpLocked();
    });
  }

  removeCan(code: string): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      if (state.inFlight?.code === code) return;
      await this.deps.cans.remove(code);
    });
  }

  /** Brings the Zyn tab forward, e.g. so the user can log in. */
  showWorker(): Promise<void> {
    return this.exclusive(async () => {
      let state = await this.deps.queueState.get();
      if (state.workerTabId === undefined) {
        await this.openWorker({ ...state, workerFailures: 0 });
        state = await this.deps.queueState.get();
      }
      if (state.workerTabId === undefined) return;
      await this.deps.tabs.focus(state.workerTabId);
      // Come back to the scanner by ourselves once the page turns ready.
      await this.deps.queueState.set({ ...state, workerAutoShown: state.workerStatus !== 'ready' });
    });
  }

  /** Queued behind running operations, so a tab that was just opened is already on record. */
  isWorkerTab(tabId: number): Promise<boolean> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      return state.workerTabId === tabId;
    });
  }

  /**
   * @param fresh true for the first report of a newly loaded page. If a redemption was in flight,
   *   the page was reloaded under it and the code goes back in line.
   */
  workerStatusChanged(tabId: number, status: WorkerPageStatus, fresh: boolean): Promise<void> {
    return this.exclusive(async () => {
      let state = await this.deps.queueState.get();
      if (tabId !== state.workerTabId) return;
      if (state.inFlight && fresh) {
        await this.requeueInFlight(state);
        state = { ...state, inFlight: undefined };
      }
      if (!state.inFlight) await this.deps.watchdog.disarm();
      await this.applyWorkerStatus(state, status);
    });
  }

  workerOutcome(tabId: number, code: string, outcome: PageOutcome): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      if (tabId !== state.workerTabId || state.inFlight?.code !== code) return;
      await this.settleInFlight(state, outcome);
    });
  }

  tabRemoved(tabId: number): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      if (tabId === state.workerTabId) {
        const cleared = await this.forgetWorker(state);
        // With the scanner still open, carry on in a fresh tab if there is work left.
        if (cleared.scannerTabId !== undefined) await this.pumpLocked();
      } else if (tabId === state.scannerTabId) {
        await this.deps.queueState.set({ ...state, scannerTabId: undefined });
        // Finishes the queue unattended, or closes the Zyn tab when nothing is left.
        await this.pumpLocked();
      }
    });
  }

  watchdogFired(): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.deps.queueState.get();
      if (state.inFlight) {
        await this.settleInFlight(state, {
          kind: 'no_response',
          detail: 'The Zyn page did not answer in time.',
        });
      } else if (state.workerTabId !== undefined && state.workerStatus === 'loading') {
        await this.applyWorkerStatus(state, 'unavailable');
      }
    });
  }

  pump(): Promise<void> {
    return this.exclusive(() => this.pumpLocked());
  }

  /** Serializes every operation so overlapping events cannot interleave their store updates. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async pumpLocked(): Promise<void> {
    const state = await this.deps.queueState.get();
    if (state.paused || state.inFlight) return;

    const usage = await this.loadUsage();
    const queued = await this.cansWithStatus('queued');
    const [next] = queued;
    if (!next) {
      await this.closeWorkerIfUnattended(state);
      return;
    }
    if (usage.capReached) {
      await this.saveWithStatus(queued, 'deferred');
      await this.closeWorkerIfUnattended(state);
      return;
    }
    if (state.workerTabId === undefined) {
      await this.openWorker(state);
      return;
    }
    if (state.workerStatus !== 'ready') return;

    const now = this.deps.now();
    await this.deps.cans.save({
      ...next,
      status: 'submitting',
      attempts: next.attempts + 1,
      updatedAt: now,
    });
    await this.deps.queueState.set({ ...state, inFlight: { code: next.code, startedAt: now } });
    await this.deps.watchdog.arm(REDEEM_WATCHDOG_MS);

    const delivered = await this.deps.tabs.sendRedeem(state.workerTabId, next.code);
    if (!delivered) await this.replaceDeadWorker(state, next);
  }

  private async settleInFlight(state: QueueState, outcome: PageOutcome): Promise<void> {
    const code = state.inFlight?.code;
    if (code === undefined) return;
    await this.deps.watchdog.disarm();

    const record = await this.deps.cans.get(code);
    const settle = async (status: CanStatus, detail: string) => {
      if (record) await this.saveWithStatus([record], status, detail);
    };
    let paused: QueuePause | undefined;

    switch (outcome.kind) {
      case 'credited': {
        await settle('credited', outcome.message);
        const usage = await this.loadUsage();
        await this.deps.usage.set(withCreditedCode(usage, outcome.codesEnteredThisMonth));
        break;
      }
      case 'rejected':
        await settle('rejected', outcome.message);
        break;
      case 'cap_reached': {
        await settle('deferred', outcome.message);
        await this.saveWithStatus(await this.cansWithStatus('queued'), 'deferred');
        await this.deps.usage.set(withCapReached(await this.loadUsage()));
        break;
      }
      case 'server_error':
        await settle('failed', outcome.message);
        paused = { reason: 'server_error', code, detail: outcome.message };
        break;
      case 'no_response':
        await settle('failed', outcome.detail);
        paused = { reason: 'no_response', code, detail: outcome.detail };
        break;
    }

    await this.deps.queueState.set({ ...state, inFlight: undefined, paused, workerFailures: 0 });
    if (!paused) this.deps.scheduleNext(() => void this.pump());
  }

  private async applyWorkerStatus(state: QueueState, status: WorkerPageStatus): Promise<void> {
    let next: QueueState = { ...state, workerStatus: status };
    if (status === 'ready') {
      if (state.workerAutoShown && state.scannerTabId !== undefined) {
        await this.deps.tabs.focus(state.scannerTabId);
      }
      next = { ...next, workerAutoShown: false };
    } else if (
      !state.workerAutoShown &&
      state.scannerTabId !== undefined &&
      state.workerTabId !== undefined
    ) {
      // The page needs the user (log in) or needs to be visible to finish loading: show it once.
      await this.deps.tabs.focus(state.workerTabId);
      next = { ...next, workerAutoShown: true };
    }
    await this.deps.queueState.set(next);
    if (status === 'ready') await this.pumpLocked();
  }

  private async openWorker(state: QueueState): Promise<void> {
    const tabId = await this.deps.tabs.openWorker();
    await this.deps.queueState.set({
      ...state,
      workerTabId: tabId,
      workerStatus: 'loading',
      workerAutoShown: false,
    });
    await this.deps.watchdog.arm(WORKER_LOAD_WATCHDOG_MS);
  }

  /** The worker tab is gone (closed or discarded): drop it and put any in-flight code back in line. */
  private async forgetWorker(state: QueueState): Promise<QueueState> {
    await this.deps.watchdog.disarm();
    if (state.inFlight) await this.requeueInFlight(state);
    const cleared: QueueState = {
      ...state,
      workerTabId: undefined,
      workerStatus: 'closed',
      workerAutoShown: false,
      inFlight: undefined,
    };
    await this.deps.queueState.set(cleared);
    return cleared;
  }

  private async replaceDeadWorker(state: QueueState, undelivered: CanRecord): Promise<void> {
    if (state.workerTabId !== undefined) await this.deps.tabs.close(state.workerTabId);
    await this.deps.watchdog.disarm();
    await this.saveWithStatus([undelivered], 'queued');

    const failures = (state.workerFailures ?? 0) + 1;
    const cleared: QueueState = {
      ...state,
      workerTabId: undefined,
      workerStatus: 'closed',
      workerAutoShown: false,
      inFlight: undefined,
      workerFailures: failures,
    };
    if (failures > MAX_WORKER_FAILURES) {
      await this.deps.queueState.set({ ...cleared, workerStatus: 'unavailable' });
      return;
    }
    await this.openWorker(cleared);
  }

  private async closeWorkerIfUnattended(state: QueueState): Promise<void> {
    if (state.scannerTabId !== undefined || state.workerTabId === undefined) return;
    await this.deps.watchdog.disarm();
    await this.deps.tabs.close(state.workerTabId);
    await this.deps.queueState.set({
      ...state,
      workerTabId: undefined,
      workerStatus: 'closed',
      workerAutoShown: false,
    });
  }

  private async requeueInFlight(state: QueueState): Promise<void> {
    if (!state.inFlight) return;
    const record = await this.deps.cans.get(state.inFlight.code);
    if (record?.status === 'submitting') await this.saveWithStatus([record], 'queued');
  }

  /** Cans left "submitting" by a service worker that died mid-redemption go back in line. */
  private async requeueOrphans(state: QueueState): Promise<void> {
    const submitting = await this.cansWithStatus('submitting');
    await this.saveWithStatus(
      submitting.filter((record) => record.code !== state.inFlight?.code),
      'queued',
    );
  }

  private async requeue(status: CanStatus): Promise<void> {
    await this.saveWithStatus(await this.cansWithStatus(status), 'queued');
  }

  /** Returns this month's usage, starting a fresh month (and releasing deferred cans) when it rolled over. */
  private async loadUsage(): Promise<MonthlyUsage> {
    const stored = await this.deps.usage.get();
    const now = this.deps.now();
    if (stored?.month === monthKey(now)) return stored;

    const fresh = emptyUsage(now);
    await this.deps.usage.set(fresh);
    await this.requeue('deferred');
    return fresh;
  }

  private async cansWithStatus(status: CanStatus): Promise<CanRecord[]> {
    const all = await this.deps.cans.getAll();
    return all
      .filter((record) => record.status === status)
      .sort((a, b) => a.scannedAt - b.scannedAt);
  }

  private async saveWithStatus(
    records: CanRecord[],
    status: CanStatus,
    detail?: string,
  ): Promise<void> {
    if (records.length === 0) return;
    const updatedAt = this.deps.now();
    await this.deps.cans.saveMany(
      records.map((record) => ({ ...record, status, updatedAt, detail })),
    );
  }
}
