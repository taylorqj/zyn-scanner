import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanRecord, ScanResult } from '@/features/redemption/types';
import { describeScan, playScanSound } from './scanFlash';
import { scanSounds } from './scanSounds';

vi.mock('./scanSounds', () => ({
  scanSounds: {
    accepted: vi.fn(),
    duplicate: vi.fn(),
    unrecognized: vi.fn(),
    credited: vi.fn(),
  },
}));

function record(code: string): CanRecord {
  return { code, status: 'queued', scannedAt: 0, updatedAt: 0, attempts: 0 };
}

describe('describeScan', () => {
  it('confirms a queued code with the code in the label', () => {
    expect(describeScan({ kind: 'queued', record: record('ABC123') })).toEqual({
      tone: 'good',
      label: 'Got it: ABC123',
    });
  });

  it('says a deferred code is saved for next month', () => {
    expect(describeScan({ kind: 'deferred', record: record('ABC123') })).toEqual({
      tone: 'neutral',
      label: 'Saved ABC123 for next month',
    });
  });

  it('says a duplicate code was already scanned', () => {
    expect(describeScan({ kind: 'duplicate', record: record('ABC123') })).toEqual({
      tone: 'neutral',
      label: 'Already scanned ABC123',
    });
  });

  it('calls an untrusted host an unfamiliar QR code without echoing the code or host', () => {
    const flash = describeScan({ kind: 'untrusted_host', host: 'evil.example', code: 'ABC123' });

    expect(flash).toEqual({ tone: 'neutral', label: 'Unfamiliar QR code' });
    expect(flash.label).not.toContain('ABC123');
    expect(flash.label).not.toContain('evil.example');
  });

  it('flags an unrecognized scan as not a Zyn code', () => {
    expect(describeScan({ kind: 'unrecognized' })).toEqual({
      tone: 'bad',
      label: 'Not a Zyn code',
    });
  });
});

describe('playScanSound', () => {
  type SoundName = keyof typeof scanSounds;
  const allSounds = Object.keys(scanSounds) as SoundName[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each<{ result: ScanResult; sound: SoundName }>([
    { result: { kind: 'queued', record: record('ABC123') }, sound: 'accepted' },
    { result: { kind: 'deferred', record: record('ABC123') }, sound: 'accepted' },
    { result: { kind: 'duplicate', record: record('ABC123') }, sound: 'duplicate' },
    { result: { kind: 'untrusted_host', host: 'evil.example', code: 'ABC123' }, sound: 'duplicate' },
    { result: { kind: 'unrecognized' }, sound: 'unrecognized' },
  ])('plays the $sound sound for a scan of kind $result.kind', ({ result, sound }) => {
    playScanSound(result);

    expect(scanSounds[sound]).toHaveBeenCalledOnce();
    for (const other of allSounds.filter((name) => name !== sound)) {
      expect(scanSounds[other]).not.toHaveBeenCalled();
    }
  });
});
