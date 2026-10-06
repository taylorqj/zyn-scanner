import type { QrDetection, QrDetector } from './types';

/**
 * Uses the fast primary detector on every frame and gives the slower fallback a look at every
 * Nth frame the primary came up empty on. Chrome's native detector has a history of silently
 * finding nothing on some macOS versions; this keeps scanning working if that happens, at a
 * bounded CPU cost.
 */
export class HybridQrDetector implements QrDetector {
  private emptyFrames = 0;
  private fallback: Promise<QrDetector> | undefined;

  constructor(
    private readonly primary: QrDetector,
    private readonly loadFallback: () => Promise<QrDetector>,
    private readonly fallbackEvery = 4,
  ) {}

  async detect(video: HTMLVideoElement): Promise<QrDetection[]> {
    let detections: QrDetection[] = [];
    try {
      detections = await this.primary.detect(video);
    } catch {
      // A failing primary is exactly what the fallback is for.
    }
    if (detections.length > 0) {
      this.emptyFrames = 0;
      return detections;
    }

    this.emptyFrames += 1;
    if (this.emptyFrames % this.fallbackEvery !== 0) return [];
    this.fallback ??= this.loadFallback();
    return (await this.fallback).detect(video);
  }
}
