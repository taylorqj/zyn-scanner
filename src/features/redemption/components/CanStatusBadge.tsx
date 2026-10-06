import { CheckIcon, ClockIcon, Loader2Icon, MoonIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { POINTS_PER_CAN } from '../monthlyUsage';
import type { CanStatus } from '../types';

const BADGES: Record<
  CanStatus,
  { label: string; className: string; Icon: ComponentType<{ className?: string }> }
> = {
  queued: { label: 'In line', className: 'bg-muted text-muted-foreground', Icon: ClockIcon },
  submitting: {
    label: 'Redeeming',
    className: 'bg-info/12 text-info [&_svg]:animate-spin',
    Icon: Loader2Icon,
  },
  credited: {
    label: `+${POINTS_PER_CAN} pts`,
    className: 'bg-success/12 text-success',
    Icon: CheckIcon,
  },
  rejected: {
    label: 'Invalid or already used',
    className: 'bg-destructive/10 text-destructive',
    Icon: XIcon,
  },
  deferred: { label: 'Next month', className: 'bg-warning/15 text-warning', Icon: MoonIcon },
  failed: {
    label: 'Needs a retry',
    className: 'bg-destructive/10 text-destructive',
    Icon: RotateCcwIcon,
  },
};

export function CanStatusBadge({ status }: { status: CanStatus }) {
  const { label, className, Icon } = BADGES[status];
  return (
    <Badge data-status={status} className={`gap-1 border-transparent font-medium ${className}`}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
