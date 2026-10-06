import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { retryDeferredCans } from '../api';
import { MONTHLY_CODE_CAP, POINTS_PER_CAN } from '../monthlyUsage';
import type { CanRecord, MonthlyUsage } from '../types';

interface MonthlyTallyProps {
  cans: CanRecord[];
  usage: MonthlyUsage;
  /** When this scanner page was opened; cans credited since then count as "this session". */
  sessionStartedAt: number;
}

export function MonthlyTally({ cans, usage, sessionStartedAt }: MonthlyTallyProps) {
  const waiting = cans.filter((can) => can.status === 'queued' || can.status === 'submitting');
  const deferred = cans.filter((can) => can.status === 'deferred');
  const creditedThisSession = cans.filter(
    (can) => can.status === 'credited' && can.updatedAt >= sessionStartedAt,
  );
  const remaining = Math.max(MONTHLY_CODE_CAP - usage.codesEntered, 0);

  return (
    <Card className="gap-5">
      <CardHeader className="items-start">
        <CardTitle className="text-muted-foreground font-medium">This month</CardTitle>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {usage.codesEntered}
          </span>
          <span className="text-muted-foreground">/ {MONTHLY_CODE_CAP} codes</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Progress value={(usage.codesEntered / MONTHLY_CODE_CAP) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {remaining === 0 ? 'Monthly limit reached' : `${remaining} left this month`}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat
            label="This session"
            value={`+${creditedThisSession.length * POINTS_PER_CAN}`}
            unit="pts"
            tone="success"
            testId="session-points"
          />
          <Stat label="In line" value={String(waiting.length)} />
          <Stat
            label="Next month"
            value={String(deferred.length)}
            tone={deferred.length > 0 ? 'warning' : undefined}
            action={
              deferred.length > 0 ? (
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-xs"
                  onClick={() => void retryDeferredCans()}
                >
                  Try now
                </Button>
              ) : undefined
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  tone?: 'success' | 'warning';
  action?: React.ReactNode;
  testId?: string;
}

function Stat({ label, value, unit, tone, action, testId }: StatProps) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : '';
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`flex items-baseline gap-1 text-lg font-semibold tabular-nums ${toneClass}`}>
        <span data-testid={testId}>
          {value}
          {unit && <span className="text-xs font-normal text-muted-foreground"> {unit}</span>}
        </span>
      </dd>
      {action}
    </div>
  );
}
