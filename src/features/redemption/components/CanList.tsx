import { ScanLineIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { removeCan, retryCan } from '../api';
import type { CanRecord } from '../types';
import { CanStatusBadge } from './CanStatusBadge';

const MAX_VISIBLE_CANS = 100;
/** Radix lays the scroll viewport out as a table, which would let long rows grow instead of truncating. */
const VIEWPORT_AS_BLOCK = '[&_[data-slot=scroll-area-viewport]>div]:block!';

export function CanList({ cans }: { cans: CanRecord[] }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Scanned cans</CardTitle>
        {cans.length > 0 && (
          <CardAction>
            <Badge variant="secondary" className="tabular-nums">
              {cans.length}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {cans.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className={`-mx-2 max-h-[28rem] ${VIEWPORT_AS_BLOCK}`}>
            <ul className="space-y-1 px-2" aria-label="Scanned cans">
              {cans.slice(0, MAX_VISIBLE_CANS).map((can) => (
                <CanRow key={can.code} can={can} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <ScanLineIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Nothing scanned yet</p>
        <p className="text-sm text-muted-foreground">
          Hold the QR code on the back of a can up to the camera. Each one lands here.
        </p>
      </div>
    </div>
  );
}

function CanRow({ can }: { can: CanRecord }) {
  const canRetry = can.status === 'failed' || can.status === 'rejected';
  const explanation = can.status === 'credited' ? undefined : can.detail;

  return (
    <li
      data-code={can.code}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors animate-in fade-in slide-in-from-top-1 hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium tracking-wide">{can.code}</p>
        {explanation && (
          <p className="truncate text-xs text-muted-foreground" title={explanation}>
            {explanation}
          </p>
        )}
      </div>
      {explanation ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <CanStatusBadge status={can.status} />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">{explanation}</TooltipContent>
        </Tooltip>
      ) : (
        <CanStatusBadge status={can.status} />
      )}
      {canRetry && (
        <Button variant="outline" size="xs" onClick={() => void retryCan(can.code)}>
          Retry
        </Button>
      )}
      {can.status !== 'submitting' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void removeCan(can.code)}
          aria-label={`Remove ${can.code}`}
          className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <XIcon />
        </Button>
      )}
    </li>
  );
}
