import type { PageOutcome, WorkerPageStatus } from './types';

/** Sent by the scanner page to the background service worker. */
export type ScannerRequest =
  | { type: 'scanner/opened' }
  | { type: 'scan/submit'; text: string; trustHost?: boolean }
  | { type: 'queue/resume' }
  | { type: 'queue/retryDeferred' }
  | { type: 'can/retry'; code: string }
  | { type: 'can/remove'; code: string }
  | { type: 'worker/show' };

/** Sent by the content script on zyn.com to the background service worker. */
export type WorkerRequest =
  | { type: 'worker/hello' }
  | { type: 'worker/status'; status: WorkerPageStatus; fresh: boolean }
  | { type: 'worker/outcome'; code: string; outcome: PageOutcome };

export type BackgroundRequest = ScannerRequest | WorkerRequest;

/** Sent by the background service worker to the content script in the worker tab. */
export interface RedeemCommand {
  type: 'worker/redeem';
  code: string;
}

export interface WorkerHelloResponse {
  isWorker: boolean;
}

export interface RedeemCommandResponse {
  accepted: boolean;
}
