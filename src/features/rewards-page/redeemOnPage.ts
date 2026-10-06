import type { PageOutcome } from '@/features/redemption/types';
import type { RewardsPage } from './rewardsPage';

export interface RedeemTiming {
  /** How long to wait for the submit button to accept the typed code. */
  enableTimeoutMs: number;
  /** How long to wait for Zyn's answer after pressing submit. */
  resultTimeoutMs: number;
}

const DEFAULT_TIMING: RedeemTiming = { enableTimeoutMs: 5_000, resultTimeoutMs: 25_000 };

/**
 * Redeems one code the way a person would on zyn.com: type it into the code box, press
 * "SUBMIT CODE", and read the message Zyn shows.
 */
export async function redeemOnPage(
  page: RewardsPage,
  code: string,
  timing: RedeemTiming = DEFAULT_TIMING,
): Promise<PageOutcome> {
  if (page.readOutcome()) page.dismissResultDialog();

  const input = page.findCodeInput();
  if (!input) return noResponse('Could not find the code box on the Zyn page.');
  typeInto(input, code);

  const button = await waitFor(page, timing.enableTimeoutMs, () => {
    const candidate = page.findSubmitButton();
    return candidate && isEnabled(candidate) ? candidate : null;
  });
  if (!button) return noResponse('The "Submit code" button never became available.');

  // The previous result can linger while its dialog animates out (minutes, in a throttled
  // background tab), and it may read exactly like the next one. Only trust a result that shows up
  // after the dialog has been seen without one: Zyn swaps in a spinner while it checks the code.
  let sawNoResult = page.readOutcome() === null;
  const stopWatching = page.onChange(() => {
    if (page.readOutcome() === null) sawNoResult = true;
  });
  button.click();
  const outcome = await waitFor(page, timing.resultTimeoutMs, () =>
    sawNoResult ? page.readOutcome() : null,
  );
  stopWatching();

  if (!outcome) return noResponse('Zyn showed no result for this code.');
  page.dismissResultDialog();
  return outcome;
}

function noResponse(detail: string): PageOutcome {
  return { kind: 'no_response', detail };
}

/**
 * Sets the value and announces it with an `input` event, which is what the page's React code
 * listens for. (Content scripts live in their own JS world, so a plain assignment is enough.)
 */
function typeInto(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  const view = input.ownerDocument.defaultView;
  if (!view) return;
  input.dispatchEvent(new view.Event('input', { bubbles: true }));
  input.dispatchEvent(new view.Event('change', { bubbles: true }));
}

function isEnabled(button: HTMLButtonElement): boolean {
  return (
    !button.disabled &&
    button.getAttribute('aria-disabled') !== 'true' &&
    !button.classList.contains('Mui-disabled')
  );
}

/**
 * Resolves with the first non-null `read()` result, re-checking on every DOM change rather than on
 * a timer, because timers in background tabs are throttled to as little as once a minute.
 */
function waitFor<T>(page: RewardsPage, timeoutMs: number, read: () => T | null): Promise<T | null> {
  return new Promise((resolve) => {
    const finish = (value: T | null) => {
      stopWatching();
      clearTimeout(timer);
      resolve(value);
    };
    const check = () => {
      const value = read();
      if (value !== null) finish(value);
    };
    const stopWatching = page.onChange(check);
    const timer = setTimeout(() => finish(read()), timeoutMs);
    check();
  });
}
