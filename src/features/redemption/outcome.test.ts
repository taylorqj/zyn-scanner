import { describe, expect, it } from 'vitest';
import { classifyResultMessage } from './outcome';

// The exact response labels zyn.com shipped in scanCodesConfig.responseLabels on 2026-10-06.
const ZYN_LABELS = {
  systemError: 'Something went wrong. Please try again later.',
  codeRedeemedSuccessfully: 'SUCCESS! One code entered and one step closer to your next reward.',
  codeLimitError:
    'You’ve already entered 60 reward codes this month! Save this code to use in the future.',
  invalidCodeError:
    'The reward code you entered is invalid or has already been used. Please try again or contact us.',
  clubMonthlyLimit:
    '50 reward codes entered, 10 more to go! You can enter up to 60 rewards codes every month. Club 3|6',
  clubCodeEntered:
    'SUCCESS! One code entered and one step closer to your next reward. Club 3|6',
  maxCodeLimit:
    '50 reward codes entered, 10 more to go! You can enter up to 60 rewards codes every month.',
  clubLimitError:
    'You’ve already entered 60 reward codes this month! Save this code to use in the future. - Club 3|6',
  firstCodeRedeemed: 'You just entered your first code! Keep going!',
};

describe('classifyResultMessage', () => {
  it.each([
    ZYN_LABELS.codeRedeemedSuccessfully,
    ZYN_LABELS.clubCodeEntered,
    ZYN_LABELS.firstCodeRedeemed,
  ])('treats "%s" as credited', (label) => {
    expect(classifyResultMessage(label)).toEqual({ kind: 'credited', message: label });
  });

  it.each([ZYN_LABELS.maxCodeLimit, ZYN_LABELS.clubMonthlyLimit])(
    'reads the running count out of "%s"',
    (label) => {
      expect(classifyResultMessage(label)).toEqual({
        kind: 'credited',
        message: label,
        codesEnteredThisMonth: 50,
      });
    },
  );

  it.each([ZYN_LABELS.codeLimitError, ZYN_LABELS.clubLimitError])(
    'treats "%s" as the monthly cap',
    (label) => {
      expect(classifyResultMessage(label)?.kind).toBe('cap_reached');
    },
  );

  it('treats the invalid-or-used message as rejected', () => {
    expect(classifyResultMessage(ZYN_LABELS.invalidCodeError)?.kind).toBe('rejected');
  });

  it('treats the generic failure message as a server error', () => {
    expect(classifyResultMessage(ZYN_LABELS.systemError)?.kind).toBe('server_error');
  });

  it('finds the message inside the rest of a dialog and tidies its whitespace', () => {
    const dialogText = `Close\n   ${ZYN_LABELS.codeRedeemedSuccessfully}\n  ENTER ANOTHER CODE`;
    expect(classifyResultMessage(dialogText)).toEqual({
      kind: 'credited',
      message: `Close ${ZYN_LABELS.codeRedeemedSuccessfully} ENTER ANOTHER CODE`,
    });
  });

  it.each([
    ['an empty dialog (the loading spinner)', '   '],
    ['an unrelated dialog', 'We use cookies to improve your experience. Accept all'],
    [
      'the code entry tooltip',
      'Using your phone, scan the QR code on the back of your can. Enter up to 60 codes per month. Every code earns 15 Rewards points.',
    ],
  ])('ignores %s', (_description, text) => {
    expect(classifyResultMessage(text)).toBeNull();
  });
});
