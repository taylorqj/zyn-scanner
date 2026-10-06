// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { redeemOnPage } from './redeemOnPage';
import { assessReadiness, createRewardsPage } from './rewardsPage';

const SUCCESS = 'SUCCESS! One code entered and one step closer to your next reward.';
const INVALID =
  'The reward code you entered is invalid or has already been used. Please try again or contact us.';
const FAST = { enableTimeoutMs: 50, resultTimeoutMs: 200 };

interface WidgetOptions {
  /** What Zyn answers for a code; null means it never answers. */
  respond: (code: string) => string | null;
  /** Keep a closed dialog's text in the DOM, like a dialog still animating out. */
  closedDialogLingers?: boolean;
}

/** A stand-in for zyn.com's code entry: same classes and roles, same enable/submit/dialog behaviour. */
function mountZynWidget({ respond, closedDialogLingers = false }: WidgetOptions) {
  document.body.innerHTML = `
    <div class="redeem-codes">
      <div class="redeem-codes-container">
        <input type="text" placeholder="e.g. 2E4CP98V0" />
        <button class="MuiButton-root submit-button" disabled>SUBMIT CODE</button>
      </div>
    </div>`;
  const input = document.querySelector('input')!;
  const button = document.querySelector('button')!;
  const submitted: string[] = [];

  const showDialog = (message: string) => {
    let root = document.querySelector('.MuiDialog-root');
    if (!root) {
      root = document.createElement('div');
      root.className = 'MuiDialog-root';
      root.innerHTML =
        '<div role="dialog"><button aria-label="Close"></button><p class="message"></p></div>';
      root.querySelector('button')!.addEventListener('click', () => {
        if (!closedDialogLingers) root!.remove();
      });
      document.body.append(root);
    }
    root.querySelector('.message')!.textContent = message;
  };

  input.addEventListener('input', () => {
    button.disabled = !input.value.trim();
  });
  button.addEventListener('click', () => {
    submitted.push(input.value);
    const message = respond(input.value);
    showDialog(''); // the loading spinner
    if (message !== null) setTimeout(() => showDialog(message), 5);
  });

  return { input, button, submitted, showDialog };
}

describe('redeemOnPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('types the code, submits it, and reports that Zyn credited it', async () => {
    const widget = mountZynWidget({ respond: () => SUCCESS });

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(widget.submitted).toEqual(['ABC123XYZ']);
    expect(outcome).toMatchObject({ kind: 'credited' });
  });

  it('closes the result dialog so the page is ready for the next code', async () => {
    mountZynWidget({ respond: () => SUCCESS });

    await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(document.querySelector('.MuiDialog-root')).toBeNull();
  });

  it('reports a rejected code', async () => {
    mountZynWidget({ respond: () => INVALID });

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome.kind).toBe('rejected');
  });

  it('redeems several codes in a row on the same page', async () => {
    const widget = mountZynWidget({
      respond: (code) => (code.startsWith('BAD') ? INVALID : SUCCESS),
    });
    const page = createRewardsPage(document);

    const outcomes = [
      await redeemOnPage(page, 'GOOD00001', FAST),
      await redeemOnPage(page, 'BAD000002', FAST),
      await redeemOnPage(page, 'GOOD00003', FAST),
    ];

    expect(widget.submitted).toEqual(['GOOD00001', 'BAD000002', 'GOOD00003']);
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['credited', 'rejected', 'credited']);
  });

  it('waits for the new answer when the previous, identical result is still on screen', async () => {
    const widget = mountZynWidget({ respond: () => SUCCESS, closedDialogLingers: true });
    widget.showDialog(SUCCESS);

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(widget.submitted).toEqual(['ABC123XYZ']);
    expect(outcome.kind).toBe('credited');
  });

  it('does not mistake a lingering old result for an answer that never came', async () => {
    const widget = mountZynWidget({ respond: () => null, closedDialogLingers: true });
    widget.showDialog(SUCCESS);
    // The page ignores the click entirely, so the old "SUCCESS" never leaves the screen.
    widget.button.addEventListener('click', (event) => event.stopImmediatePropagation(), true);

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome.kind).toBe('no_response');
  });

  it('gives up when Zyn shows no result', async () => {
    mountZynWidget({ respond: () => null });

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome).toEqual({ kind: 'no_response', detail: 'Zyn showed no result for this code.' });
  });

  it('gives up when the page has no code box', async () => {
    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome.kind).toBe('no_response');
  });

  it('gives up when the submit button stays disabled', async () => {
    const widget = mountZynWidget({ respond: () => SUCCESS });
    widget.input.addEventListener('input', () => {
      widget.button.disabled = true;
    });

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(widget.submitted).toEqual([]);
    expect(outcome.kind).toBe('no_response');
  });

  it('ignores dialogs that are not a redemption result', async () => {
    mountZynWidget({ respond: () => SUCCESS });
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" id="cookies">We use cookies. Accept all</div>',
    );

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome.kind).toBe('credited');
    expect(document.querySelector('#cookies')).not.toBeNull();
  });
});

describe('assessReadiness', () => {
  const clearSession = () => {
    document.cookie = 'gig_uid=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    clearSession();
  });

  it('needs a login when the Zyn session cookie is missing', () => {
    mountZynWidget({ respond: () => SUCCESS });

    expect(assessReadiness(createRewardsPage(document))).toBe('login_required');
  });

  it('is still loading while logged in but away from the rewards page', () => {
    document.cookie = 'gig_uid=abc123';
    mountZynWidget({ respond: () => SUCCESS });

    // The test page's URL is not the rewards page.
    expect(assessReadiness(createRewardsPage(document))).toBe('loading');
  });
});

describe('result message', () => {
  it('leaves the dialog buttons out of the message that gets recorded', async () => {
    document.body.innerHTML = '';
    mountZynWidget({ respond: () => SUCCESS });

    const outcome = await redeemOnPage(createRewardsPage(document), 'ABC123XYZ', FAST);

    expect(outcome).toEqual({ kind: 'credited', message: SUCCESS });
  });
});
