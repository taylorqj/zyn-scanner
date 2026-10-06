# Zyn Scanner

A Chrome extension (WXT, React 19, shadcn/ui on Tailwind 4) that turns a pile of Zyn cans into reward points: click the toolbar icon, hold
each can's QR code up to your webcam, and the code is redeemed on your own logged-in Zyn Rewards
page in the background.

## How it works

- **Scanner page** (`scanner.html`): shows the webcam and decodes QR codes with Chrome's built-in
  `BarcodeDetector`, with [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) as a safety net.
- **Background service worker**: keeps a queue of scanned codes and feeds them one at a time to a
  Zyn rewards tab it opens next to the scanner.
- **Content script** on `www.zyn.com`: types each code into Zyn's own code box, presses
  "SUBMIT CODE", reads the message Zyn shows, and reports back. It only ever acts in the tab the
  scanner opened, so your other Zyn tabs are left alone.

Everything runs inside your normal Chrome session with your normal login. Nothing is sent anywhere
except to zyn.com, exactly as if you had typed the code in yourself. Scan history, the monthly count
(Zyn allows 60 codes a month) and cans saved for next month are stored in the extension's storage.

## Install

**From a release:** grab the latest `zyn-scanner-*-chrome.zip` from the
[Releases](../../releases) page and unzip it. Then in Chrome: `chrome://extensions` → turn on
**Developer mode** → **Load unpacked** → choose the unzipped folder. Pin the icon if you like;
`Alt+Shift+Z` opens the scanner too.

**From source:**

```sh
pnpm install
pnpm build          # writes dist/chrome-mv3, load that folder as above
```

Tested on macOS Chrome. On Windows and Linux, Chrome has no built-in QR detector, so the bundled
WebAssembly decoder does all the work (it is a bit slower, nothing else changes).

## Use

1. Click the icon. The scanner opens, asks for the camera once, and opens a Zyn tab in the
   background. If you are not logged in to zyn.com the Zyn tab comes forward so you can log in;
   the scanner comes back by itself afterwards.
2. Hold the QR code on the back of each can up to the camera. A beep and a green "Got it" mean the
   can is in line; a chime means Zyn credited it. The list on the right shows every can and what
   Zyn said about it.
3. Scan the whole pile. Cans beyond Zyn's monthly limit are kept and redeemed when you open the
   scanner next month (or sooner with "Try now").

If the laptop camera cannot focus on the small code, pick your iPhone in the camera menu
(Continuity Camera) or move the can further away.

## Development

```sh
pnpm dev            # WXT dev mode with hot reload
pnpm compile        # type-check
pnpm test           # unit tests (vitest)
pnpm test:e2e       # builds, then drives the extension in Chromium with a fake webcam and a
                    # local stand-in for zyn.com (never touches the real site)
pnpm icons          # regenerates public/icon/*.png
```

Layout (WXT conventions):

```txt
src/
  entrypoints/
    background.ts             # queue orchestration, tab management
    zyn-rewards.content.ts    # runs on zyn.com: readiness reports + redeem commands
    scanner/                  # the scanner page (React)
  features/
    redemption/               # code parsing, Zyn result classification, queue service, UI
    rewards-page/             # DOM driver for Zyn's code entry widget
    scanner/                  # camera, QR detectors, scan feedback
  lib/storageItems.ts         # extension storage schema
e2e/                          # Playwright suite with fake camera and mock Zyn server
```

## Good to know

- This is an unofficial hobby project with no connection to ZYN, Swedish Match or PMI. It drives
  zyn.com the way you would by hand, nothing more, but automated entry may still be against the
  rewards program's terms, so use it at your own risk.
- It relies on the structure of zyn.com's code entry page. If Zyn changes the page, the scanner
  will report "no result" rather than guess; the selectors live in
  `src/features/rewards-page/rewardsPage.ts`.
- MIT licensed. Issues and pull requests welcome.
