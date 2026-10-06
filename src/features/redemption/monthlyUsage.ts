import type { MonthlyUsage } from './types';

/** From zyn.com: "Enter up to 60 codes per month. Every code earns 15 Rewards points." */
export const MONTHLY_CODE_CAP = 60;
export const POINTS_PER_CAN = 15;

export function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function emptyUsage(timestamp: number): MonthlyUsage {
  return { month: monthKey(timestamp), codesEntered: 0, capReached: false };
}

/**
 * Counts one more credited code. When Zyn's message states the real count ("50 reward codes
 * entered, 10 more to go!") that number wins, since codes may also be entered outside the scanner.
 */
export function withCreditedCode(usage: MonthlyUsage, countFromZyn?: number): MonthlyUsage {
  return { ...usage, codesEntered: countFromZyn ?? usage.codesEntered + 1 };
}

export function withCapReached(usage: MonthlyUsage): MonthlyUsage {
  return {
    ...usage,
    codesEntered: Math.max(usage.codesEntered, MONTHLY_CODE_CAP),
    capReached: true,
  };
}
