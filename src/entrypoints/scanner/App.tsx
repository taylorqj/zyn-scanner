import { ScanLineIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { notifyScannerOpened, submitScan } from '@/features/redemption/api';
import { CanList } from '@/features/redemption/components/CanList';
import { MonthlyTally } from '@/features/redemption/components/MonthlyTally';
import { QueueBanner } from '@/features/redemption/components/QueueBanner';
import {
  UntrustedHostPrompt,
  type UntrustedHostScan,
} from '@/features/redemption/components/UntrustedHostPrompt';
import { WorkerStatusChip } from '@/features/redemption/components/WorkerStatusChip';
import {
  useCans,
  useMonthlyUsage,
  useQueueState,
} from '@/features/redemption/hooks/useRedemptionState';
import type { CanRecord } from '@/features/redemption/types';
import { CameraPanel } from '@/features/scanner/components/CameraPanel';
import { detectorPreferenceFromUrl } from '@/features/scanner/detectors/createQrDetector';
import { useCamera } from '@/features/scanner/hooks/useCamera';
import { useQrScanner } from '@/features/scanner/hooks/useQrScanner';
import { describeScan, playScanSound, type ScanFlash } from '@/features/scanner/scanFlash';
import { scanSounds } from '@/features/scanner/scanSounds';
import { usePersistedState } from '@/hooks/usePersistedState';

const FLASH_MS = 2_500;
const DETECTOR_PREFERENCE = detectorPreferenceFromUrl(location.search);

export function App() {
  const cans = useCans();
  const queue = useQueueState();
  const usage = useMonthlyUsage();
  const [sessionStartedAt] = useState(() => Date.now());

  const [deviceId, setDeviceId] = usePersistedState<string | undefined>('camera', undefined);
  const [mirrored, setMirrored] = usePersistedState('mirrored', true);
  const [soundOn, setSoundOn] = usePersistedState('sound', true);
  const [flash, setFlash] = useState<ScanFlash | null>(null);
  const [hostPrompt, setHostPrompt] = useState<UntrustedHostScan | null>(null);

  useEffect(() => {
    void notifyScannerOpened();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleScan = useCallback(
    async (text: string, trustHost = false) => {
      const result = await submitScan(text, trustHost);
      if (!result) return;
      setFlash(describeScan(result));
      if (soundOn) playScanSound(result);
      if (result.kind === 'untrusted_host') {
        setHostPrompt({ text, host: result.host, code: result.code });
      }
    },
    [soundOn],
  );

  const camera = useCamera(deviceId);
  const outline = useQrScanner(camera.videoRef, handleScan, DETECTOR_PREFERENCE);
  useCreditedChime(cans, soundOn);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
              <ScanLineIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Zyn Scanner</h1>
              <p className="text-sm text-muted-foreground">
                Hold a can up to the camera. The rest is automatic.
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <WorkerStatusChip status={queue.workerStatus} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {soundOn ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
              <span className="sr-only">Sound</span>
              <Switch checked={soundOn} onCheckedChange={setSoundOn} aria-label="Sound" />
            </label>
          </div>
        </header>

        <main className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <CameraPanel
            camera={camera}
            outline={outline}
            flash={flash}
            mirrored={mirrored}
            onMirroredChange={setMirrored}
            onDeviceChange={setDeviceId}
            onManualCode={(code) => void handleScan(code)}
          />

          <aside className="space-y-6">
            <MonthlyTally cans={cans} usage={usage} sessionStartedAt={sessionStartedAt} />
            <QueueBanner queue={queue} usage={usage} />
            {hostPrompt && (
              <UntrustedHostPrompt
                scan={hostPrompt}
                onConfirm={() => {
                  void handleScan(hostPrompt.text, true);
                  setHostPrompt(null);
                }}
                onDismiss={() => setHostPrompt(null)}
              />
            )}
            <CanList cans={cans} />
          </aside>
        </main>
      </div>
    </TooltipProvider>
  );
}

/** Plays a chime whenever a can turns "credited", so a pile can be scanned without watching the list. */
function useCreditedChime(cans: CanRecord[], enabled: boolean): void {
  const previousStatuses = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const previous = previousStatuses.current;
    const newlyCredited = cans.some(
      (can) =>
        can.status === 'credited' &&
        previous !== null &&
        previous.get(can.code) !== undefined &&
        previous.get(can.code) !== 'credited',
    );
    if (newlyCredited && enabled) scanSounds.credited();
    previousStatuses.current = new Map(cans.map((can) => [can.code, can.status]));
  }, [cans, enabled]);
}
