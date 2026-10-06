import { beforeEach, describe, expect, it } from 'vitest';
import { RedemptionService } from './redemptionService';
import { FakeTabDriver, FakeWatchdog, InMemoryCanRepository, MemoryStore } from './testing/fakes';
import type { MonthlyUsage, PageOutcome, QueueState } from './types';

const SCANNER_TAB = 1;
const CREDITED: PageOutcome = { kind: 'credited', message: 'SUCCESS! One code entered.' };
const canLink = (code: string) => `https://us.zyn.com/ZYNRewards/?serialNumber=${code}`;

function createHarness() {
  let now = new Date(2026, 9, 6, 12).getTime();
  const cans = new InMemoryCanRepository();
  const queueState = new MemoryStore<QueueState>({ workerStatus: 'closed' });
  const usage = new MemoryStore<MonthlyUsage | null>(null);
  const trustedHosts = new MemoryStore<string[]>([]);
  const tabs = new FakeTabDriver();
  const watchdog = new FakeWatchdog();
  const scheduled: (() => void)[] = [];
  const service = new RedemptionService({
    cans,
    queueState,
    usage,
    trustedHosts,
    tabs,
    watchdog,
    now: () => now,
    scheduleNext: (task) => scheduled.push(task),
  });

  return {
    service,
    cans,
    queueState,
    usage,
    trustedHosts,
    tabs,
    watchdog,
    setNow(date: Date) {
      now = date.getTime();
    },
    /** Lets the pause between two redemptions elapse. */
    async runScheduled() {
      for (const task of scheduled.splice(0)) task();
      await service.pump();
    },
    async statusOf(code: string) {
      return (await cans.get(code))?.status;
    },
    /** Opens the scanner and lets the Zyn tab report ready. Returns the Zyn tab's id. */
    async openScannerWithReadyWorker() {
      await service.scannerOpened(SCANNER_TAB);
      const workerTab = tabs.opened[0]!;
      await service.workerStatusChanged(workerTab, 'ready', true);
      return workerTab;
    },
  };
}

describe('RedemptionService', () => {
  let h: ReturnType<typeof createHarness>;
  beforeEach(() => {
    h = createHarness();
  });

  it('opens the Zyn tab in the background as soon as the scanner opens', async () => {
    await h.service.scannerOpened(SCANNER_TAB);

    expect(h.tabs.opened).toHaveLength(1);
    expect(h.queueState.value.workerStatus).toBe('loading');
    expect(h.tabs.focused).toEqual([]);
  });

  it('redeems a scanned can and counts it', async () => {
    const workerTab = await h.openScannerWithReadyWorker();

    const result = await h.service.submitScan(canLink('ABC123XYZ'));

    expect(result.kind).toBe('queued');
    expect(h.tabs.redeemRequests).toEqual([{ tabId: workerTab, code: 'ABC123XYZ' }]);
    expect(await h.statusOf('ABC123XYZ')).toBe('submitting');

    await h.service.workerOutcome(workerTab, 'ABC123XYZ', CREDITED);

    expect(await h.statusOf('ABC123XYZ')).toBe('credited');
    expect(h.usage.value).toMatchObject({ month: '2026-10', codesEntered: 1, capReached: false });
    expect(h.watchdog.armedForMs).toBeNull();
  });

  it('redeems one can at a time, in the order they were scanned', async () => {
    const workerTab = await h.openScannerWithReadyWorker();
    await h.service.submitScan(canLink('FIRST0001'));
    await h.service.submitScan(canLink('SECOND002'));

    expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual(['FIRST0001']);
    expect(await h.statusOf('SECOND002')).toBe('queued');

    await h.service.workerOutcome(workerTab, 'FIRST0001', CREDITED);
    expect(h.tabs.redeemRequests).toHaveLength(1);

    await h.runScheduled();
    expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual([
      'FIRST0001',
      'SECOND002',
    ]);
  });

  it('holds scans in line until the Zyn tab is ready', async () => {
    await h.service.scannerOpened(SCANNER_TAB);
    await h.service.submitScan(canLink('ABC123XYZ'));
    expect(h.tabs.redeemRequests).toEqual([]);

    await h.service.workerStatusChanged(h.tabs.opened[0]!, 'ready', true);
    expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual(['ABC123XYZ']);
  });

  it('reports a can that was already scanned instead of queueing it twice', async () => {
    const workerTab = await h.openScannerWithReadyWorker();
    await h.service.submitScan(canLink('ABC123XYZ'));
    await h.service.workerOutcome(workerTab, 'ABC123XYZ', CREDITED);

    const again = await h.service.submitScan('ABC123XYZ');

    expect(again).toMatchObject({ kind: 'duplicate', record: { status: 'credited' } });
    expect(h.tabs.redeemRequests).toHaveLength(1);
  });

  it('rejects text that is not a can code', async () => {
    await h.openScannerWithReadyWorker();
    expect(await h.service.submitScan('https://www.zyn.com/us/en/faq.html')).toEqual({
      kind: 'unrecognized',
    });
    expect(await h.cans.getAll()).toEqual([]);
  });

  it('asks before trusting a QR code on an unknown host, then remembers the host', async () => {
    await h.openScannerWithReadyWorker();

    const first = await h.service.submitScan('https://cans.example/ABC123XYZ');
    expect(first).toEqual({ kind: 'untrusted_host', host: 'cans.example', code: 'ABC123XYZ' });
    expect(await h.cans.getAll()).toEqual([]);

    const confirmed = await h.service.submitScan('https://cans.example/ABC123XYZ', {
      trustHost: true,
    });
    expect(confirmed.kind).toBe('queued');
    expect(h.trustedHosts.value).toEqual(['cans.example']);

    const nextCan = await h.service.submitScan('https://cans.example/DEF456UVW');
    expect(nextCan.kind).toBe('queued');
  });

  it('records a rejected code and moves on', async () => {
    const workerTab = await h.openScannerWithReadyWorker();
    await h.service.submitScan(canLink('USED00001'));
    await h.service.submitScan(canLink('FRESH0002'));

    await h.service.workerOutcome(workerTab, 'USED00001', {
      kind: 'rejected',
      message: 'The reward code you entered is invalid or has already been used.',
    });
    await h.runScheduled();

    expect(await h.statusOf('USED00001')).toBe('rejected');
    expect(h.usage.value?.codesEntered).toBe(0);
    expect(h.tabs.redeemRequests.at(-1)?.code).toBe('FRESH0002');
  });

  it('adopts the monthly count Zyn states in its message', async () => {
    const workerTab = await h.openScannerWithReadyWorker();
    await h.service.submitScan(canLink('ABC123XYZ'));

    await h.service.workerOutcome(workerTab, 'ABC123XYZ', {
      kind: 'credited',
      message: '50 reward codes entered, 10 more to go!',
      codesEnteredThisMonth: 50,
    });

    expect(h.usage.value?.codesEntered).toBe(50);
  });

  describe('monthly cap', () => {
    const CAP: PageOutcome = {
      kind: 'cap_reached',
      message: 'You’ve already entered 60 reward codes this month!',
    };

    it('saves the refused can and everything behind it for next month', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('OVERCAP01'));
      await h.service.submitScan(canLink('OVERCAP02'));

      await h.service.workerOutcome(workerTab, 'OVERCAP01', CAP);
      await h.runScheduled();

      expect(await h.statusOf('OVERCAP01')).toBe('deferred');
      expect(await h.statusOf('OVERCAP02')).toBe('deferred');
      expect(h.usage.value).toMatchObject({ codesEntered: 60, capReached: true });
      expect(h.tabs.redeemRequests).toHaveLength(1);
    });

    it('saves new scans without asking Zyn again while the cap holds', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('OVERCAP01'));
      await h.service.workerOutcome(workerTab, 'OVERCAP01', CAP);

      const result = await h.service.submitScan(canLink('LATER0003'));

      expect(result.kind).toBe('deferred');
      expect(h.tabs.redeemRequests).toHaveLength(1);
    });

    it('releases the saved cans when a new month starts', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('OVERCAP01'));
      await h.service.workerOutcome(workerTab, 'OVERCAP01', CAP);

      h.setNow(new Date(2026, 10, 1, 9));
      await h.service.scannerOpened(SCANNER_TAB);

      expect(h.usage.value).toEqual({ month: '2026-11', codesEntered: 0, capReached: false });
      expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual([
        'OVERCAP01',
        'OVERCAP01',
      ]);
    });

    it('lets the user try the saved cans right away', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('OVERCAP01'));
      await h.service.workerOutcome(workerTab, 'OVERCAP01', CAP);

      await h.service.retryDeferred();

      expect(await h.statusOf('OVERCAP01')).toBe('submitting');
      expect(h.tabs.redeemRequests).toHaveLength(2);
    });
  });

  describe('when the Zyn page needs the user', () => {
    it('brings the Zyn tab forward once when login is required, and keeps scans in line', async () => {
      await h.service.scannerOpened(SCANNER_TAB);
      const workerTab = h.tabs.opened[0]!;

      await h.service.workerStatusChanged(workerTab, 'login_required', true);
      await h.service.workerStatusChanged(workerTab, 'login_required', false);
      const result = await h.service.submitScan(canLink('ABC123XYZ'));

      expect(h.tabs.focused).toEqual([workerTab]);
      expect(result.kind).toBe('queued');
      expect(h.tabs.redeemRequests).toEqual([]);
    });

    it('returns to the scanner and starts redeeming once the page turns ready', async () => {
      await h.service.scannerOpened(SCANNER_TAB);
      const workerTab = h.tabs.opened[0]!;
      await h.service.workerStatusChanged(workerTab, 'login_required', true);
      await h.service.submitScan(canLink('ABC123XYZ'));

      // After logging in, zyn.com loads a new page in the same tab.
      await h.service.workerStatusChanged(workerTab, 'ready', true);

      expect(h.tabs.focused).toEqual([workerTab, SCANNER_TAB]);
      expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual(['ABC123XYZ']);
    });

    it('marks the page unavailable when it never reports in', async () => {
      await h.service.scannerOpened(SCANNER_TAB);

      await h.service.watchdogFired();

      expect(h.queueState.value.workerStatus).toBe('unavailable');
      expect(h.tabs.focused).toEqual([h.tabs.opened[0]]);
    });
  });

  describe('when a redemption goes wrong', () => {
    it('pauses on a server error and retries that code on resume', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));
      await h.service.submitScan(canLink('NEXT00002'));

      await h.service.workerOutcome(workerTab, 'ABC123XYZ', {
        kind: 'server_error',
        message: 'Something went wrong. Please try again later.',
      });
      await h.runScheduled();

      expect(await h.statusOf('ABC123XYZ')).toBe('failed');
      expect(h.queueState.value.paused).toMatchObject({ reason: 'server_error', code: 'ABC123XYZ' });
      expect(h.tabs.redeemRequests).toHaveLength(1);

      await h.service.resume();

      expect(h.queueState.value.paused).toBeUndefined();
      expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual([
        'ABC123XYZ',
        'ABC123XYZ',
      ]);
    });

    it('pauses when the Zyn page never answers', async () => {
      await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));
      expect(h.watchdog.armedForMs).not.toBeNull();

      await h.service.watchdogFired();

      expect(await h.statusOf('ABC123XYZ')).toBe('failed');
      expect(h.queueState.value.paused?.reason).toBe('no_response');
      expect(h.queueState.value.inFlight).toBeUndefined();
    });

    it('queues a failed can again when it is scanned again', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));
      await h.service.workerOutcome(workerTab, 'ABC123XYZ', {
        kind: 'no_response',
        detail: 'Zyn showed no result for this code.',
      });

      const rescan = await h.service.submitScan(canLink('ABC123XYZ'));

      expect(rescan.kind).toBe('queued');
    });

    it('puts the can back in line when the page reloads under it', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));

      await h.service.workerStatusChanged(workerTab, 'ready', true);

      expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual([
        'ABC123XYZ',
        'ABC123XYZ',
      ]);
      expect(await h.statusOf('ABC123XYZ')).toBe('submitting');
    });

    it('carries on in a new tab when the Zyn tab is closed mid-redemption', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));

      await h.service.tabRemoved(workerTab);

      expect(await h.statusOf('ABC123XYZ')).toBe('queued');
      expect(h.tabs.opened).toHaveLength(2);
      expect(h.queueState.value).toMatchObject({
        workerTabId: h.tabs.opened[1],
        workerStatus: 'loading',
      });
    });

    it('replaces a Zyn tab that stopped listening, but gives up after repeated failures', async () => {
      await h.openScannerWithReadyWorker();
      h.tabs.delivers = false;

      await h.service.submitScan(canLink('ABC123XYZ'));
      expect(h.tabs.opened).toHaveLength(2);
      expect(await h.statusOf('ABC123XYZ')).toBe('queued');

      await h.service.workerStatusChanged(h.tabs.opened[1]!, 'ready', true);
      await h.service.workerStatusChanged(h.tabs.opened[2]!, 'ready', true);

      expect(h.tabs.opened).toHaveLength(3);
      expect(h.queueState.value.workerStatus).toBe('unavailable');
      expect(await h.statusOf('ABC123XYZ')).toBe('queued');
    });

    it('ignores answers that do not come from the Zyn tab for the code in flight', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('ABC123XYZ'));

      await h.service.workerOutcome(999, 'ABC123XYZ', CREDITED);
      await h.service.workerOutcome(workerTab, 'OTHER0001', CREDITED);

      expect(await h.statusOf('ABC123XYZ')).toBe('submitting');
    });
  });

  describe('when the scanner is closed', () => {
    it('closes the Zyn tab if nothing is in line', async () => {
      const workerTab = await h.openScannerWithReadyWorker();

      await h.service.tabRemoved(SCANNER_TAB);

      expect(h.tabs.closed).toEqual([workerTab]);
      expect(h.queueState.value.workerStatus).toBe('closed');
    });

    it('finishes the queue first, then closes the Zyn tab', async () => {
      const workerTab = await h.openScannerWithReadyWorker();
      await h.service.submitScan(canLink('FIRST0001'));
      await h.service.submitScan(canLink('SECOND002'));

      await h.service.tabRemoved(SCANNER_TAB);
      expect(h.tabs.closed).toEqual([]);

      await h.service.workerOutcome(workerTab, 'FIRST0001', CREDITED);
      await h.runScheduled();
      await h.service.workerOutcome(workerTab, 'SECOND002', CREDITED);
      await h.runScheduled();

      expect(await h.statusOf('SECOND002')).toBe('credited');
      expect(h.tabs.closed).toEqual([workerTab]);
    });
  });

  it('recovers cans left mid-redemption by a previous browser session', async () => {
    await h.cans.save({
      code: 'ORPHAN001',
      status: 'submitting',
      scannedAt: 1,
      updatedAt: 1,
      attempts: 1,
    });

    await h.openScannerWithReadyWorker();

    expect(h.tabs.redeemRequests.map((request) => request.code)).toEqual(['ORPHAN001']);
  });
});
