import { describe, expect, it } from 'vitest';
import { emptyUsage, monthKey, withCapReached, withCreditedCode } from './monthlyUsage';

describe('monthly usage', () => {
  it('keys a timestamp by its local calendar month', () => {
    expect(monthKey(new Date(2026, 9, 6, 12).getTime())).toBe('2026-10');
    expect(monthKey(new Date(2027, 0, 1, 0, 0, 1).getTime())).toBe('2027-01');
  });

  it('counts one more code per credit', () => {
    const usage = emptyUsage(new Date(2026, 9, 6).getTime());
    expect(withCreditedCode(withCreditedCode(usage)).codesEntered).toBe(2);
  });

  it('lets the count stated by Zyn override the local count', () => {
    const usage = { ...emptyUsage(new Date(2026, 9, 6).getTime()), codesEntered: 3 };
    expect(withCreditedCode(usage, 50).codesEntered).toBe(50);
  });

  it('marks the cap and never shows fewer than the cap once reached', () => {
    const usage = { ...emptyUsage(new Date(2026, 9, 6).getTime()), codesEntered: 12 };
    expect(withCapReached(usage)).toMatchObject({ codesEntered: 60, capReached: true });
  });
});
