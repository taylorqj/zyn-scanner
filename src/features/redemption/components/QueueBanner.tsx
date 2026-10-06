import { CalendarClockIcon, LogInIcon, PauseCircleIcon, UnplugIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resumeQueue, showZynTab } from '../api';
import type { MonthlyUsage, QueueState } from '../types';

/** Explains why redemption is not moving, with the one action that gets it moving again. */
export function QueueBanner({ queue, usage }: { queue: QueueState; usage: MonthlyUsage }) {
  if (queue.paused) {
    return (
      <Banner
        tone="problem"
        icon={<PauseCircleIcon />}
        title={
          <>
            Paused on <span className="font-mono">{queue.paused.code}</span>
          </>
        }
        description={queue.paused.detail}
        actions={
          <>
            <Button size="sm" onClick={() => void resumeQueue()}>
              Resume
            </Button>
            <Button size="sm" variant="outline" onClick={() => void showZynTab()}>
              Show Zyn tab
            </Button>
          </>
        }
      />
    );
  }
  if (queue.workerStatus === 'login_required') {
    return (
      <Banner
        tone="problem"
        icon={<LogInIcon />}
        title="Log in to Zyn to start redeeming"
        description="Cans you scan in the meantime wait in line."
        actions={
          <Button size="sm" onClick={() => void showZynTab()}>
            Open Zyn tab
          </Button>
        }
      />
    );
  }
  if (queue.workerStatus === 'unavailable') {
    return (
      <Banner
        tone="problem"
        icon={<UnplugIcon />}
        title="The Zyn rewards page is not responding"
        description="Cans you scan in the meantime wait in line."
        actions={
          <Button size="sm" onClick={() => void showZynTab()}>
            Open Zyn tab
          </Button>
        }
      />
    );
  }
  if (usage.capReached) {
    return (
      <Banner
        tone="notice"
        icon={<CalendarClockIcon />}
        title="Zyn’s monthly limit is reached"
        description="New scans are saved and redeemed next month."
      />
    );
  }
  return null;
}

interface BannerProps {
  tone: 'problem' | 'notice';
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}

function Banner({ tone, icon, title, description, actions }: BannerProps) {
  return (
    <Alert
      variant={tone === 'problem' ? 'destructive' : 'default'}
      className={`animate-in fade-in ${tone === 'notice' ? 'border-warning/40 bg-warning/10 [&>svg]:text-warning' : 'bg-destructive/5'}`}
    >
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </AlertDescription>
    </Alert>
  );
}
