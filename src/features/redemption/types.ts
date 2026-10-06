export type CanStatus =
  | 'queued'
  | 'submitting'
  | 'credited'
  | 'rejected'
  | 'deferred'
  | 'failed';

export interface CanRecord {
  code: string;
  status: CanStatus;
  scannedAt: number;
  updatedAt: number;
  attempts: number;
  /** What Zyn said about the last attempt, or why the attempt never got an answer. */
  detail?: string;
}

/** What the Zyn rewards page reported after a code was submitted. */
export type PageOutcome =
  | { kind: 'credited'; message: string; codesEnteredThisMonth?: number }
  /** Zyn uses one message for both "invalid" and "already used". */
  | { kind: 'rejected'; message: string }
  | { kind: 'cap_reached'; message: string }
  | { kind: 'server_error'; message: string }
  | { kind: 'no_response'; detail: string };

/** State of the Zyn rewards tab the extension drives ("the worker tab"). */
export type WorkerStatus = 'closed' | 'loading' | 'ready' | 'login_required' | 'unavailable';

export type WorkerPageStatus = Extract<WorkerStatus, 'ready' | 'login_required' | 'unavailable'>;

export interface QueuePause {
  reason: 'server_error' | 'no_response';
  code: string;
  detail: string;
}

export interface QueueState {
  scannerTabId?: number;
  workerTabId?: number;
  workerStatus: WorkerStatus;
  /** True when the extension brought the worker tab forward and owes a switch back to the scanner. */
  workerAutoShown?: boolean;
  /** Consecutive times the worker tab stopped answering; bounds the reopen loop. */
  workerFailures?: number;
  inFlight?: { code: string; startedAt: number };
  paused?: QueuePause;
}

export interface MonthlyUsage {
  /** Local calendar month, `YYYY-MM`. */
  month: string;
  codesEntered: number;
  /** Set only when Zyn itself says the monthly limit is hit. */
  capReached: boolean;
}

export type ScanResult =
  | { kind: 'queued'; record: CanRecord }
  | { kind: 'deferred'; record: CanRecord }
  | { kind: 'duplicate'; record: CanRecord }
  | { kind: 'untrusted_host'; host: string; code: string }
  | { kind: 'unrecognized' };
