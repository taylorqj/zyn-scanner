// Renders scripts/icon.svg to the PNG sizes Chrome wants, using the Chromium that Playwright
// already installs for the e2e tests. Run with `pnpm icons`; the output in public/icon is committed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 128];
/** Below this size the viewfinder corners turn to mush, so the small icons show only a bigger lid. */
const SIMPLIFY_AT = 32;
const SMALL_STYLE = '#corners{display:none}#lid{transform:scale(1.4);transform-origin:64px 64px}';
const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const outDir = new URL('../public/icon/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}${size <= SIMPLIFY_AT ? SMALL_STYLE : ''}</style>${svg}`,
    );
    writeFileSync(new URL(`${size}.png`, outDir), await page.screenshot({ omitBackground: true }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Wrote ${SIZES.map((size) => `${size}.png`).join(', ')}`);
