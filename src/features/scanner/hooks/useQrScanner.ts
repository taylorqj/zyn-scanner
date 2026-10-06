import { useEffect, useRef, useState } from 'react';
import { createQrDetector, type DetectorPreference } from '../detectors/createQrDetector';
import type { QrDetection } from '../detectors/types';

const SCAN_INTERVAL_MS = 120;
/** A code counts as shown again only after it has been out of view this long. */
const OUT_OF_VIEW_MS = 1_500;

/**
 * Looks for QR codes in the video and calls `onScan` once each time a code is held up, no matter
 * how long it stays in view. Returns the detection to outline, if a code is currently visible.
 */
export function useQrScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onScan: (text: string) => void,
  preference: DetectorPreference = 'auto',
): QrDetection | null {
  const [visible, setVisible] = useState<QrDetection | null>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detector = createQrDetector(preference);
    const lastSeenAt = new Map<string, number>();

    const scanFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        return;
      }
      const detections = await (await detector).detect(video);
      if (stopped) return;
      setVisible(detections[0] ?? null);

      const now = performance.now();
      for (const { text } of detections) {
        const seenAt = lastSeenAt.get(text);
        lastSeenAt.set(text, now);
        if (seenAt === undefined || now - seenAt > OUT_OF_VIEW_MS) onScanRef.current(text);
      }
    };

    const loop = async () => {
      try {
        await scanFrame();
      } catch {
        // A frame can fail to decode while the stream starts or switches cameras; try the next one.
      }
      if (!stopped) timer = setTimeout(loop, SCAN_INTERVAL_MS);
    };
    void loop();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [videoRef, preference]);

  return visible;
}
