import { HybridQrDetector } from './hybridQrDetector';
import { NativeQrDetector } from './nativeQrDetector';
import type { QrDetector } from './types';

export type DetectorPreference = 'auto' | 'native' | 'zxing';

async function loadZxingDetector(): Promise<QrDetector> {
  // Imported on demand so the WebAssembly decoder is only fetched when it is actually used.
  const { ZxingQrDetector } = await import('./zxingQrDetector');
  return new ZxingQrDetector();
}

export async function createQrDetector(preference: DetectorPreference = 'auto'): Promise<QrDetector> {
  if (preference === 'zxing' || !(await NativeQrDetector.isSupported())) {
    return loadZxingDetector();
  }
  const native = new NativeQrDetector();
  return preference === 'native' ? native : new HybridQrDetector(native, loadZxingDetector);
}

/** `scanner.html?detector=zxing` (or `native`) pins one engine, for troubleshooting and tests. */
export function detectorPreferenceFromUrl(search: string): DetectorPreference {
  const value = new URLSearchParams(search).get('detector');
  return value === 'native' || value === 'zxing' ? value : 'auto';
}
