import { browser } from 'wxt/browser';
import type { ScannerRequest } from './messages';
import type { ScanResult } from './types';

function send<T = void>(request: ScannerRequest): Promise<T | undefined> {
  return browser.runtime.sendMessage(request);
}

export const notifyScannerOpened = () => send({ type: 'scanner/opened' });

/** `trustHost` confirms that a QR code pointing outside zyn.com really is a Zyn can. */
export const submitScan = (text: string, trustHost = false) =>
  send<ScanResult>({ type: 'scan/submit', text, trustHost });

export const resumeQueue = () => send({ type: 'queue/resume' });
export const retryDeferredCans = () => send({ type: 'queue/retryDeferred' });
export const retryCan = (code: string) => send({ type: 'can/retry', code });
export const removeCan = (code: string) => send({ type: 'can/remove', code });
export const showZynTab = () => send({ type: 'worker/show' });
