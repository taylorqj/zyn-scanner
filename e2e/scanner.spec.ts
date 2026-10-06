import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { launchWithExtension, logInToZyn, openScanner, zynTab } from './support/extension';
import { writeQrVideo } from './support/fakeCamera';
import { startZynMock, type ZynMock } from './support/zynMock';

const FIXTURES = path.resolve('e2e/.fixtures');
const CAN_VIDEO = path.join(FIXTURES, 'cans.y4m');
const CODES = ['E2EGOOD01', 'BADCODE02', 'E2EGOOD03'];
const canLink = (code: string) => `https://us.zyn.com/ZYNRewards/?serialNumber=${code}`;

test.beforeAll(() => {
  mkdirSync(FIXTURES, { recursive: true });
  writeQrVideo(CAN_VIDEO, CODES.map(canLink));
});

let zyn: ZynMock;
let context: BrowserContext;

async function launch(options: { monthlyCap?: number; loggedIn: boolean }) {
  zyn = await startZynMock({ monthlyCap: options.monthlyCap });
  context = await launchWithExtension({ cameraVideo: CAN_VIDEO, zynMockPort: zyn.port });
  if (options.loggedIn) await logInToZyn(context);
}

test.afterEach(async () => {
  await context?.close();
  await zyn?.close();
});

for (const detector of ['auto', 'zxing'] as const) {
  test(`scans cans from the camera and redeems them on the Zyn page (${detector} detector)`, async () => {
    await launch({ loggedIn: true });

    const scanner = await openScanner(context, `?detector=${detector}`);

    await expect(scanner.locator('[data-worker-status="ready"]')).toBeVisible();
    await expect(scanner.locator('li[data-code="E2EGOOD01"] [data-status="credited"]')).toBeVisible();
    await expect(scanner.locator('li[data-code="BADCODE02"] [data-status="rejected"]')).toBeVisible();
    await expect(scanner.locator('li[data-code="E2EGOOD03"] [data-status="credited"]')).toBeVisible();
    await expect(scanner.getByTestId('session-points')).toHaveText('+30 pts');

    // The camera loops over the same three cans; each must reach Zyn exactly once.
    await scanner.waitForTimeout(3_000);
    expect([...zyn.claims].sort()).toEqual([...CODES].sort());
    expect(await scanner.locator('li[data-code]').count()).toBe(3);
  });
}

test('keeps scans in line until the user logs in to Zyn, then redeems them', async () => {
  await launch({ loggedIn: false });

  const scanner = await openScanner(context);

  await expect(scanner.locator('[data-worker-status="login_required"]')).toBeVisible();
  await expect(scanner.getByRole('alert').filter({ hasText: 'Log in to Zyn' })).toBeVisible();
  await expect(scanner.locator('li[data-code="E2EGOOD01"] [data-status="queued"]')).toBeVisible();
  expect(zyn.claims).toEqual([]);

  const zynPage = await zynTab(context);
  await zynPage.getByRole('button', { name: 'Log in' }).click();

  await expect(scanner.locator('[data-worker-status="ready"]')).toBeVisible();
  await expect(scanner.locator('li[data-code="E2EGOOD01"] [data-status="credited"]')).toBeVisible();
  await expect(scanner.locator('li[data-code="E2EGOOD03"] [data-status="credited"]')).toBeVisible();
});

test('saves cans for next month once Zyn reports the monthly limit', async () => {
  await launch({ loggedIn: true, monthlyCap: 1 });

  const scanner = await openScanner(context);

  await expect(scanner.locator('li[data-code="E2EGOOD01"] [data-status="credited"]')).toBeVisible();
  await expect(scanner.locator('li[data-code="E2EGOOD03"] [data-status="deferred"]')).toBeVisible();
  await expect(scanner.getByRole('alert').filter({ hasText: 'monthly limit' })).toBeVisible();
});
