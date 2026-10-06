import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  // Each test launches its own browser with the extension loaded; keep them sequential.
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});
