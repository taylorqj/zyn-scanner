import type { ScanResult } from '@/features/redemption/types';
import { scanSounds } from './scanSounds';

export interface ScanFlash {
  tone: 'good' | 'neutral' | 'bad';
  label: string;
}

/** The on-camera message for a scan, so the user knows it registered without looking away. */
export function describeScan(result: ScanResult): ScanFlash {
  switch (result.kind) {
    case 'queued':
      return { tone: 'good', label: `Got it: ${result.record.code}` };
    case 'deferred':
      return { tone: 'neutral', label: `Saved ${result.record.code} for next month` };
    case 'duplicate':
      return { tone: 'neutral', label: `Already scanned ${result.record.code}` };
    case 'untrusted_host':
      return { tone: 'neutral', label: 'Unfamiliar QR code' };
    case 'unrecognized':
      return { tone: 'bad', label: 'Not a Zyn code' };
  }
}

export function playScanSound(result: ScanResult): void {
  if (result.kind === 'queued' || result.kind === 'deferred') scanSounds.accepted();
  else if (result.kind === 'unrecognized') scanSounds.unrecognized();
  else scanSounds.duplicate();
}
