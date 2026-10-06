import { classifyResultMessage } from '@/features/redemption/outcome';
import type { PageOutcome } from '@/features/redemption/types';

export const REWARDS_ORIGIN = 'https://www.zyn.com';
export const REWARDS_PATH = '/us/en/zyn-rewards.html';
export const REWARDS_URL = `${REWARDS_ORIGIN}${REWARDS_PATH}`;

/** zyn.com keeps the signed-in consumer id here and builds its "claim code" request from it. */
const SESSION_COOKIE = 'gig_uid';

// zyn.com renders the code entry with Material UI inside a `.redeem-codes` block.
const REDEEM_WIDGET = '.redeem-codes';
const SUBMIT_BUTTON = '.submit-button';
const DIALOGS = '.MuiDialog-root, [role="dialog"], [role="alertdialog"]';
const DIALOG_CLOSE = 'button[aria-label="Close"]';

/** The parts of Zyn's rewards page the scanner touches. */
export interface RewardsPage {
  isLoggedIn(): boolean;
  isRewardsPage(): boolean;
  findCodeInput(): HTMLInputElement | null;
  findSubmitButton(): HTMLButtonElement | null;
  /** The result currently shown in Zyn's dialog, if any. */
  readOutcome(): PageOutcome | null;
  dismissResultDialog(): void;
  /** Calls back on every DOM change until the returned function is called. */
  onChange(listener: () => void): () => void;
}

export function createRewardsPage(doc: Document): RewardsPage {
  const findResultDialog = (): { dialog: Element; outcome: PageOutcome } | null => {
    for (const dialog of doc.querySelectorAll(DIALOGS)) {
      const outcome = classifyResultMessage(messageText(dialog));
      if (outcome) return { dialog, outcome };
    }
    return null;
  };

  return {
    isLoggedIn() {
      return doc.cookie.split(';').some((cookie) => {
        const [name, value] = cookie.trim().split('=');
        return name === SESSION_COOKIE && Boolean(value);
      });
    },

    isRewardsPage() {
      return doc.location?.pathname === REWARDS_PATH;
    },

    findCodeInput() {
      const inputs = doc.querySelectorAll<HTMLInputElement>(`${REDEEM_WIDGET} input`);
      return (
        Array.from(inputs).find((input) => input.type === 'text' && !input.disabled) ?? null
      );
    },

    findSubmitButton() {
      const widget = doc.querySelector(REDEEM_WIDGET);
      if (!widget) return null;
      const tagged = widget.querySelector(SUBMIT_BUTTON);
      const button =
        tagged?.tagName === 'BUTTON'
          ? tagged
          : (tagged?.querySelector('button') ??
            tagged?.closest('button') ??
            Array.from(widget.querySelectorAll('button')).find((candidate) =>
              /submit code/i.test(candidate.textContent ?? ''),
            ));
      return (button as HTMLButtonElement | undefined) ?? null;
    },

    readOutcome() {
      return findResultDialog()?.outcome ?? null;
    },

    dismissResultDialog() {
      const result = findResultDialog();
      if (!result) return;
      const closeButton = result.dialog.querySelector<HTMLElement>(DIALOG_CLOSE);
      if (closeButton) {
        closeButton.click();
        return;
      }
      const view = doc.defaultView;
      if (!view) return;
      result.dialog.dispatchEvent(
        new view.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    },

    onChange(listener) {
      const view = doc.defaultView;
      if (!view) return () => undefined;
      const observer = new view.MutationObserver(listener);
      observer.observe(doc.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      return () => observer.disconnect();
    },
  };
}

/** The dialog's text without its buttons ("Close", "Enter another code"), i.e. Zyn's message. */
function messageText(dialog: Element): string {
  const copy = dialog.cloneNode(true) as Element;
  copy.querySelectorAll('button, [role="button"]').forEach((button) => button.remove());
  return copy.textContent ?? '';
}

export type PageReadiness = 'ready' | 'login_required' | 'loading';

export function assessReadiness(page: RewardsPage): PageReadiness {
  if (!page.isLoggedIn()) return 'login_required';
  if (!page.isRewardsPage()) return 'loading';
  return page.findCodeInput() && page.findSubmitButton() ? 'ready' : 'loading';
}
