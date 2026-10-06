import type { PageOutcome } from './types';

// The patterns below match the response labels zyn.com ships in its page config
// (scanCodesConfig.responseLabels), loosely enough to survive small copy edits.
const CAP_REACHED = /already entered \d+ reward codes|save this code to use in the future/i;
const REJECTED = /invalid or has already been used|code you entered is invalid/i;
const SERVER_ERROR = /something went wrong/i;
const CODES_ENTERED = /(\d+) reward codes entered, \d+ more to go/i;
const CREDITED = /success!|one step closer to your next reward|entered your first code/i;

/** Classifies the text of Zyn's result dialog, or returns null when it is not a result message. */
export function classifyResultMessage(rawText: string): PageOutcome | null {
  const message = rawText.replace(/\s+/g, ' ').trim();
  if (!message) return null;

  if (CAP_REACHED.test(message)) return { kind: 'cap_reached', message };
  if (REJECTED.test(message)) return { kind: 'rejected', message };
  if (SERVER_ERROR.test(message)) return { kind: 'server_error', message };

  const codesEntered = CODES_ENTERED.exec(message);
  if (codesEntered) {
    return { kind: 'credited', message, codesEnteredThisMonth: Number(codesEntered[1]) };
  }
  if (CREDITED.test(message)) return { kind: 'credited', message };

  return null;
}
