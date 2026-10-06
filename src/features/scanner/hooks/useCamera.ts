import { useEffect, useRef, useState } from 'react';

export interface CameraState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  devices: MediaDeviceInfo[];
  /** The camera actually in use, which may differ from the requested one if that was unplugged. */
  activeDeviceId: string | undefined;
  error: string | null;
}

// A can's QR code is small; ask for as many pixels as the camera has.
const VIDEO_QUALITY = { width: { ideal: 1920 }, height: { ideal: 1080 } };

async function openCamera(deviceId: string | undefined): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...VIDEO_QUALITY, deviceId: deviceId ? { exact: deviceId } : undefined },
    });
  } catch (error) {
    // The remembered camera is gone (e.g. an iPhone that walked away): use whatever is there.
    if (deviceId && error instanceof DOMException && error.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: VIDEO_QUALITY });
    }
    throw error;
  }
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Camera access is blocked. Allow the camera for this page in Chrome, then reload.';
    }
    if (error.name === 'NotFoundError') return 'No camera found.';
    if (error.name === 'NotReadableError') return 'The camera is in use by another app.';
  }
  return 'Could not start the camera.';
}

async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

export function useCamera(deviceId: string | undefined): CameraState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;

    const start = async () => {
      try {
        stream = await openCamera(deviceId);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setActiveDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId);
        setError(null);
        // Camera names are only readable once permission is granted, so list them after opening.
        setDevices(await listCameras());
      } catch (cause) {
        if (!cancelled) setError(describeCameraError(cause));
      }
    };
    void start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId]);

  useEffect(() => {
    const refresh = () => void listCameras().then(setDevices);
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, []);

  return { videoRef, devices, activeDeviceId, error };
}
