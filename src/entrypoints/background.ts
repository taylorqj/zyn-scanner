import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { WATCHDOG_ALARM } from '@/features/redemption/browserAdapters';
import { createRedemptionService } from '@/features/redemption/createRedemptionService';
import type { BackgroundRequest, WorkerHelloResponse } from '@/features/redemption/messages';
import type { RedemptionService } from '@/features/redemption/redemptionService';

export default defineBackground(() => {
  const service = createRedemptionService();

  browser.action.onClicked.addListener(() => {
    void openScanner();
  });

  browser.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    handleRequest(service, request, sender).then(sendResponse, (error: unknown) => {
      console.error('[zyn-scanner] request failed', request.type, error);
      sendResponse(undefined);
    });
    return true;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void service.tabRemoved(tabId);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHDOG_ALARM) void service.watchdogFired();
  });
});

async function handleRequest(
  service: RedemptionService,
  request: BackgroundRequest,
  sender: Browser.runtime.MessageSender,
): Promise<unknown> {
  const tabId = sender.tab?.id;

  switch (request.type) {
    case 'worker/hello': {
      const isWorker = tabId !== undefined && (await service.isWorkerTab(tabId));
      return { isWorker } satisfies WorkerHelloResponse;
    }
    case 'worker/status':
      if (tabId !== undefined) {
        await service.workerStatusChanged(tabId, request.status, request.fresh);
      }
      return;
    case 'worker/outcome':
      if (tabId !== undefined) await service.workerOutcome(tabId, request.code, request.outcome);
      return;
  }

  // Everything below belongs to the scanner page; a content script on a web page must not reach it.
  if (!sender.url?.startsWith(browser.runtime.getURL('/'))) return;

  switch (request.type) {
    case 'scanner/opened':
      if (tabId !== undefined) await service.scannerOpened(tabId);
      return;
    case 'scan/submit':
      return service.submitScan(request.text, { trustHost: request.trustHost });
    case 'queue/resume':
      return service.resume();
    case 'queue/retryDeferred':
      return service.retryDeferred();
    case 'can/retry':
      return service.retryCan(request.code);
    case 'can/remove':
      return service.removeCan(request.code);
    case 'worker/show':
      return service.showWorker();
  }
}

/** Focuses the scanner tab if one is open, otherwise opens it. */
async function openScanner(): Promise<void> {
  const url = browser.runtime.getURL('/scanner.html');
  const [existing] = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.TAB],
    documentUrls: [url],
  });
  if (existing && existing.tabId >= 0) {
    await browser.tabs.update(existing.tabId, { active: true });
    await browser.windows.update(existing.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url });
}
