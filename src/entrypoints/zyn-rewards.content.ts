import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type {
  RedeemCommand,
  RedeemCommandResponse,
  WorkerHelloResponse,
  WorkerRequest,
} from '@/features/redemption/messages';
import type { WorkerPageStatus } from '@/features/redemption/types';
import { redeemOnPage } from '@/features/rewards-page/redeemOnPage';
import {
  assessReadiness,
  createRewardsPage,
  REWARDS_URL,
  type RewardsPage,
} from '@/features/rewards-page/rewardsPage';

const POLL_MS = 1_000;
/** A missing session cookie must hold this many polls before the page counts as logged out. */
const LOGGED_OUT_POLLS = 3;
const UNAVAILABLE_AFTER_MS = 8_000;
const REDIRECT_GUARD_KEY = 'zyn-scanner:redirected-at';
const REDIRECT_GUARD_MS = 30_000;

export default defineContentScript({
  matches: ['https://www.zyn.com/*'],
  runAt: 'document_idle',

  async main() {
    // Stay inert on every zyn.com tab except the one the scanner opened for redeeming codes.
    const hello = await send<WorkerHelloResponse>({ type: 'worker/hello' });
    if (!hello?.isWorker) return;

    const page = createRewardsPage(document);
    listenForRedeemCommands(page);
    await reportReadiness(page);
  },
});

function send<T = void>(request: WorkerRequest): Promise<T | undefined> {
  return browser.runtime.sendMessage(request).catch(() => undefined);
}

function listenForRedeemCommands(page: RewardsPage): void {
  let busy = false;
  browser.runtime.onMessage.addListener((command: RedeemCommand, _sender, sendResponse) => {
    if (command?.type !== 'worker/redeem') return;
    sendResponse({ accepted: !busy } satisfies RedeemCommandResponse);
    if (busy) return;

    busy = true;
    void redeemOnPage(page, command.code)
      .then((outcome) => send({ type: 'worker/outcome', code: command.code, outcome }))
      .finally(() => {
        busy = false;
      });
  });
}

/** Tells the background whenever the page becomes (un)able to redeem codes. Runs for the page's lifetime. */
async function reportReadiness(page: RewardsPage): Promise<never> {
  const startedAt = Date.now();
  let reported: WorkerPageStatus | undefined;
  let loggedOutPolls = 0;

  for (;;) {
    const readiness = assessReadiness(page);
    loggedOutPolls = readiness === 'login_required' ? loggedOutPolls + 1 : 0;

    let status: WorkerPageStatus | undefined;
    if (readiness === 'ready') {
      status = 'ready';
    } else if (readiness === 'login_required') {
      if (loggedOutPolls >= LOGGED_OUT_POLLS) status = 'login_required';
    } else if (!page.isRewardsPage() && returnToRewardsPage()) {
      // Logged in but somewhere else on zyn.com, typically right after signing in.
      status = undefined;
    } else if (Date.now() - startedAt > UNAVAILABLE_AFTER_MS) {
      status = 'unavailable';
    }

    if (status && status !== reported) {
      await send({ type: 'worker/status', status, fresh: reported === undefined });
      reported = status;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** Navigates back to the rewards page, at most once per guard window so a redirect cannot loop. */
function returnToRewardsPage(): boolean {
  const lastRedirect = Number(sessionStorage.getItem(REDIRECT_GUARD_KEY) ?? 0);
  if (Date.now() - lastRedirect < REDIRECT_GUARD_MS) return false;
  sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()));
  location.replace(REWARDS_URL);
  return true;
}
