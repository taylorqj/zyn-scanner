import { describe, expect, it, vi } from 'vitest';
import { HybridQrDetector } from './hybridQrDetector';
import type { QrDetection, QrDetector } from './types';

const VIDEO = {} as HTMLVideoElement;
const HIT: QrDetection = { text: 'https://us.zyn.com/ZYNRewards/?serialNumber=ABC123XYZ', corners: [] };

function detectorReturning(...results: (QrDetection[] | Error)[]): QrDetector & { calls: number } {
  const detector = {
    calls: 0,
    async detect() {
      const result = results[Math.min(detector.calls, results.length - 1)] ?? [];
      detector.calls += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return detector;
}

describe('HybridQrDetector', () => {
  it('returns the primary result without loading the fallback', async () => {
    const loadFallback = vi.fn();
    const hybrid = new HybridQrDetector(detectorReturning([HIT]), loadFallback);

    expect(await hybrid.detect(VIDEO)).toEqual([HIT]);
    expect(loadFallback).not.toHaveBeenCalled();
  });

  it('gives the fallback every Nth frame the primary finds nothing on', async () => {
    const fallback = detectorReturning([HIT]);
    const hybrid = new HybridQrDetector(detectorReturning([]), async () => fallback, 3);

    expect(await hybrid.detect(VIDEO)).toEqual([]);
    expect(await hybrid.detect(VIDEO)).toEqual([]);
    expect(await hybrid.detect(VIDEO)).toEqual([HIT]);
    expect(fallback.calls).toBe(1);
  });

  it('falls back when the primary throws', async () => {
    const fallback = detectorReturning([HIT]);
    const hybrid = new HybridQrDetector(
      detectorReturning(new Error('service unavailable')),
      async () => fallback,
      1,
    );

    expect(await hybrid.detect(VIDEO)).toEqual([HIT]);
  });

  it('loads the fallback only once', async () => {
    const loadFallback = vi.fn(async () => detectorReturning([]));
    const hybrid = new HybridQrDetector(detectorReturning([]), loadFallback, 1);

    await hybrid.detect(VIDEO);
    await hybrid.detect(VIDEO);
    expect(loadFallback).toHaveBeenCalledTimes(1);
  });
});
