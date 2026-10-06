# Zyn Scanner

Turn a pile of Zyn cans into reward points without typing a single code. Click the icon, hold each
can up to your webcam, done: every code is entered on your own Zyn Rewards page in the background,
and you see what Zyn said about each can as it happens.

Everything runs inside your normal Chrome with your normal Zyn login. Nothing is sent anywhere
except to zyn.com, exactly as if you had typed the code in yourself.

## Install (two minutes)

1. Download `zyn-scanner-<version>-chrome.zip` from the [latest release](../../releases/latest)
   and unzip it somewhere you will leave it (Chrome loads the extension from that folder).
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (switch in the top-right corner).
4. Click **Load unpacked** and choose the unzipped folder.
5. Optional: click the puzzle-piece icon in Chrome's toolbar and pin **Zyn Scanner** so it is
   always one click away.

Chrome will say "unpacked extension" because it is not from the Web Store; that is expected.

## Use

1. Log in at [zyn.com](https://www.zyn.com) once, in the same Chrome profile.
2. Click the Zyn Scanner icon (or press `Alt+Shift+Z`). Allow the camera the first time.
3. Wait for the pill in the top-right corner to say **Zyn ready**. If it says **Zyn login
   needed**, the Zyn tab comes forward by itself so you can log in; the scanner returns on its own
   afterwards.
4. Hold the QR code on the back of a can up to the camera, roughly 15–30 cm (6–12 in) away.
   - A beep and a green **Got it** pill mean the can is in line.
   - A chime means Zyn credited it; the list on the right shows **+15 pts**.
5. Keep going with the next can. You can scan as fast as the camera reads them; the codes are
   entered one at a time in the background and the list fills in as Zyn answers.

Tips:

- **Camera will not focus?** Laptop cameras are fixed-focus. Move the can further away rather
  than closer, avoid glare on the label, and give it a second. On a Mac, pick your iPhone from the
  camera menu (Continuity Camera) for a much sharper picture.
- **QR code scratched?** Type the printed code in the box under the camera and press **Add**.
- **Mirror** flips the preview so moving the can feels natural with a front-facing camera; turn it
  off for a rear or external camera.
- The sound switch in the top-right corner mutes the beeps and chimes.

## What the labels mean

| Label                   | Meaning                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| In line                 | Scanned, waiting its turn.                                                |
| Redeeming               | Being entered on the Zyn page right now.                                  |
| +15 pts                 | Zyn credited it.                                                          |
| Invalid or already used | Zyn refused it (Zyn uses one message for both cases).                     |
| Next month              | Zyn's limit of 60 codes a month is reached; saved and entered next month. |
| Needs a retry           | Zyn gave an error or no answer; **Retry** tries again.                    |

The **This month** card counts codes entered through the scanner. When Zyn mentions its own
count ("50 reward codes entered, 10 more to go"), the card adopts that number.

## When something is off

- **Zyn login needed**: click **Open Zyn tab**, log in on Zyn's page, and come back. Cans scanned
  in the meantime wait in line and go through on their own.
- **Zyn not responding**: click **Open Zyn tab** and look at the page. If it shows a verification
  step or an error, deal with it there; the scanner picks up again once the page is ready.
- **Paused on a code**: the banner shows Zyn's message. **Resume** tries that code again and
  carries on; **Retry** on a single can does the same for just that one.
- **Monthly limit reached**: nothing to do. Open the scanner again next month and the saved cans
  are entered automatically, or press **Try now** if you think the count is off.
- Rescanning a can that already went through just shows **Already scanned**; nothing is entered
  twice.

## Privacy

The extension talks to zyn.com and nothing else. Your scan history and the monthly count live in
the extension's local storage in your browser. There is no account, no server and no analytics.

## Good to know

- This is an unofficial hobby project with no connection to ZYN, Swedish Match or PMI. It drives
  zyn.com the way you would by hand, nothing more, but automated entry may still be against the
  rewards program's terms, so use it at your own risk.
- It relies on the structure of zyn.com's code entry page. If Zyn changes the page, the scanner
  reports "no result" rather than guessing; the selectors live in
  `src/features/rewards-page/rewardsPage.ts`.
- Tested on macOS Chrome. On Windows and Linux, Chrome has no built-in QR detector, so the bundled
  WebAssembly decoder does all the work (a bit slower, otherwise the same).
- MIT licensed. Issues and pull requests welcome.

## How it works

- **Scanner page** (`scanner.html`): shows the webcam and decodes QR codes with Chrome's built-in
  `BarcodeDetector`, with [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) as a safety net.
- **Background service worker**: keeps a queue of scanned codes and feeds them one at a time to a
  Zyn rewards tab it opens next to the scanner.
- **Content script** on `www.zyn.com`: types each code into Zyn's own code box, presses
  "SUBMIT CODE", reads the message Zyn shows, and reports back. It only ever acts in the tab the
  scanner opened, so your other Zyn tabs are left alone.

## Development

Built with [WXT](https://wxt.dev), React 19, shadcn/ui and Tailwind 4.

```sh
pnpm install
pnpm dev            # WXT dev mode with hot reload
pnpm build          # writes dist/chrome-mv3; load that folder as an unpacked extension
pnpm compile        # type-check
pnpm test           # unit tests (vitest)
pnpm test:e2e       # builds, then drives the extension in Chromium with a fake webcam and a
                    # local stand-in for zyn.com (never touches the real site)
pnpm icons          # re-renders public/icon/*.png from scripts/icon.svg
pnpm zip            # packages dist/ for a release
```

Layout (WXT conventions):

```txt
src/
  entrypoints/
    background.ts             # queue orchestration, tab management
    zyn-rewards.content.ts    # runs on zyn.com: readiness reports + redeem commands
    scanner/                  # the scanner page (React)
  components/ui/              # shadcn/ui components
  features/
    redemption/               # code parsing, Zyn result classification, queue service, UI
    rewards-page/             # DOM driver for Zyn's code entry widget
    scanner/                  # camera, QR detectors, scan feedback
  lib/storageItems.ts         # extension storage schema
e2e/                          # Playwright suite with fake camera and mock Zyn server
```

Releases: bump `version` in `package.json`, commit, then `git tag v<version> && git push --tags`.
CI builds the zip and attaches it to a GitHub release.
