import { CameraIcon, FlipHorizontal2Icon } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { QrDetection } from '../detectors/types';
import type { CameraState } from '../hooks/useCamera';
import type { ScanFlash } from '../scanFlash';
import { ManualCodeForm } from './ManualCodeForm';

interface CameraPanelProps {
  camera: CameraState;
  /** The QR code currently in view, outlined on top of the video. */
  outline: QrDetection | null;
  flash: ScanFlash | null;
  mirrored: boolean;
  onMirroredChange: (mirrored: boolean) => void;
  onDeviceChange: (deviceId: string) => void;
  onManualCode: (code: string) => void;
}

const FLASH_RING: Record<ScanFlash['tone'], string> = {
  good: 'ring-success',
  neutral: 'ring-warning',
  bad: 'ring-destructive',
};

const FLASH_PILL: Record<ScanFlash['tone'], string> = {
  good: 'bg-success text-white',
  neutral: 'bg-warning text-white',
  bad: 'bg-destructive text-white',
};

export function CameraPanel({
  camera,
  outline,
  flash,
  mirrored,
  onMirroredChange,
  onDeviceChange,
  onManualCode,
}: CameraPanelProps) {
  const video = camera.videoRef.current;

  return (
    <Card className="gap-4 pt-4">
      <CardContent className="px-4">
        <div
          className={`relative aspect-video overflow-hidden rounded-lg bg-muted ring-4 transition-[box-shadow] duration-300 ${
            flash ? FLASH_RING[flash.tone] : 'ring-transparent'
          }`}
        >
          <div className={`size-full ${mirrored ? '-scale-x-100' : ''}`}>
            <video ref={camera.videoRef} muted playsInline className="size-full object-cover" />
            {outline && video && video.videoWidth > 0 && (
              <svg
                viewBox={`0 0 ${video.videoWidth} ${video.videoHeight}`}
                preserveAspectRatio="xMidYMid slice"
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden
              >
                <polygon
                  points={outline.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                  className="fill-success/15 stroke-success"
                  strokeWidth={Math.max(video.videoWidth / 300, 2)}
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          {camera.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <CameraIcon className="size-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">{camera.error}</p>
            </div>
          )}
          {flash && (
            <p
              role="status"
              data-testid="scan-flash"
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg animate-in fade-in zoom-in-95 ${FLASH_PILL[flash.tone]}`}
            >
              {flash.label}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4 px-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={camera.activeDeviceId ?? ''}
            onValueChange={onDeviceChange}
            disabled={camera.devices.length === 0}
          >
            <SelectTrigger className="min-w-0 flex-1" aria-label="Camera">
              <CameraIcon className="text-muted-foreground" />
              <SelectValue placeholder="Waiting for camera…" />
            </SelectTrigger>
            <SelectContent>
              {camera.devices.map((device, index) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <FlipHorizontal2Icon className="size-4" />
            Mirror
            <Switch checked={mirrored} onCheckedChange={onMirroredChange} />
          </label>
        </div>
        <ManualCodeForm onSubmit={onManualCode} />
      </CardFooter>
    </Card>
  );
}
