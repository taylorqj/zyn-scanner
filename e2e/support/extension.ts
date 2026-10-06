import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';

const EXTENSION_DIR = path.resolve('dist/chrome-mv3');

interface LaunchOptions {
  /** A Y4M file the fake webcam plays on a loop. */
  cameraVideo: string;
  /** Local port standing in for https://www.zyn.com, so no test ever reaches the real site. */
  zynMockPort: number;
}

export async function launchWithExtension({ cameraVideo, zynMockPort }: LaunchOptions): Promise<BrowserContext> {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'zyn-scanner-e2e-'));
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      `--host-resolver-rules=MAP www.zyn.com 127.0.0.1:${zynMockPort}`,
      '--ignore-certificate-errors',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${cameraVideo}`,
    ],
  });
}

export async function logInToZyn(context: BrowserContext): Promise<void> {
  await context.addCookies([
    { name: 'gig_uid', value: 'dGVzdC11c2Vy', domain: 'www.zyn.com', path: '/' },
  ]);
}

export async function extensionId(context: BrowserContext): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return new URL(worker.url()).host;
}

export async function openScanner(context: BrowserContext, query = ''): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${await extensionId(context)}/scanner.html${query}`);
  return page;
}

/** The tab the extension opened on zyn.com. */
export async function zynTab(context: BrowserContext): Promise<Page> {
  const existing = context.pages().find((page) => page.url().startsWith('https://www.zyn.com/'));
  if (existing) return existing;
  return context.waitForEvent('page', {
    predicate: (page) => page.url().startsWith('https://www.zyn.com/'),
  });
}
