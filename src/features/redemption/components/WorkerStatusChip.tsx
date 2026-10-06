import { Badge } from '@/components/ui/badge';
import type { WorkerStatus } from '../types';

const CHIPS: Record<WorkerStatus, { label: string; dotClass: string }> = {
  closed: { label: 'Zyn tab closed', dotClass: 'bg-muted-foreground/60' },
  loading: { label: 'Connecting to Zyn', dotClass: 'bg-warning animate-pulse' },
  ready: { label: 'Zyn ready', dotClass: 'bg-success' },
  login_required: { label: 'Zyn login needed', dotClass: 'bg-destructive' },
  unavailable: { label: 'Zyn not responding', dotClass: 'bg-destructive' },
};

/** Whether the Zyn tab is ready to take codes. */
export function WorkerStatusChip({ status }: { status: WorkerStatus }) {
  const chip = CHIPS[status];
  return (
    <Badge variant="outline" data-worker-status={status} className="gap-2 py-1 pr-3 pl-2.5 font-normal">
      <span className={`size-2 rounded-full ${chip.dotClass}`} />
      {chip.label}
    </Badge>
  );
}
