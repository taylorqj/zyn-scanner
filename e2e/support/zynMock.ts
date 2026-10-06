import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

export const ZYN_LABELS = {
  success: 'SUCCESS! One code entered and one step closer to your next reward.',
  invalid:
    'The reward code you entered is invalid or has already been used. Please try again or contact us.',
  limit: 'You’ve already entered 60 reward codes this month! Save this code to use in the future.',
};

/**
 * A stand-in for zyn.com's rewards page with the same structure the content script relies on:
 * a `.redeem-codes` block with a text input and a `.submit-button`, a session cookie named
 * `gig_uid`, a React-style controlled input, and a Material UI dialog that shows a spinner while
 * the claim request is in flight and then Zyn's message.
 */
const PAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>ZYN Rewards (mock)</title></head>
<body>
  <h1>ZYN Rewards</h1>
  <div id="login-wall" hidden>
    <p>Log in to enter codes.</p>
    <button id="login">Log in</button>
  </div>
  <div class="redeem-codes" hidden>
    <div class="redeem-codes-container">
      <label>Enter Codes <input type="text" placeholder="e.g. 2E4CP98V0" /></label>
      <button class="MuiButton-root submit-button" disabled>SUBMIT CODE</button>
    </div>
  </div>
  <script>
    const loggedIn = document.cookie.split(';').some((c) => c.trim().startsWith('gig_uid='));
    document.getElementById('login-wall').hidden = loggedIn;
    document.querySelector('.redeem-codes').hidden = !loggedIn;
    document.getElementById('login').addEventListener('click', () => {
      document.cookie = 'gig_uid=dGVzdC11c2Vy; path=/';
      location.reload();
    });

    const input = document.querySelector('input');
    const button = document.querySelector('.submit-button');
    // Like React's controlled input: an input event only counts when the DOM value differs from
    // the value the component last rendered.
    let rendered = '';
    input.addEventListener('input', () => {
      if (input.value === rendered) return;
      rendered = input.value;
      button.disabled = !rendered.trim();
    });

    let dialog = null;
    const showDialog = (message) => {
      if (!dialog) {
        dialog = document.createElement('div');
        dialog.className = 'MuiDialog-root';
        dialog.innerHTML = '<div role="dialog"><button aria-label="Close">×</button><p class="message"></p></div>';
        dialog.querySelector('button').addEventListener('click', () => {
          dialog.querySelector('.message').textContent = '';
          setTimeout(() => { dialog.remove(); dialog = null; }, 300);
        });
        document.body.append(dialog);
      }
      dialog.querySelector('.message').textContent = message;
    };

    button.addEventListener('click', async () => {
      showDialog('');
      const response = await fetch('/claim?code=' + encodeURIComponent(rendered));
      const { message } = await response.json();
      showDialog(message);
    });
  </script>
</body></html>`;

export interface ZynMock {
  /** Port of the local HTTPS server; Chromium is told to resolve www.zyn.com to it. */
  port: number;
  /** Codes the mock received, in order. */
  claims: string[];
  close(): Promise<void>;
}

const CERT_DIR = path.resolve('e2e/.fixtures');
const KEY_FILE = path.join(CERT_DIR, 'zyn-mock-key.pem');
const CERT_FILE = path.join(CERT_DIR, 'zyn-mock-cert.pem');

/** A throwaway self-signed certificate; the browser is launched with certificate errors ignored. */
function ensureCertificate(): { key: Buffer; cert: Buffer } {
  if (!existsSync(KEY_FILE) || !existsSync(CERT_FILE)) {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=www.zyn.com', '-keyout', KEY_FILE, '-out', CERT_FILE,
    ], { stdio: 'ignore' });
  }
  return { key: readFileSync(KEY_FILE), cert: readFileSync(CERT_FILE) };
}

export async function startZynMock({ monthlyCap = 60 }: { monthlyCap?: number } = {}): Promise<ZynMock> {
  const claims: string[] = [];

  const server: Server = createServer(ensureCertificate(), (request, response) => {
    const url = new URL(request.url ?? '/', 'https://www.zyn.com');
    if (url.pathname === '/claim') {
      const code = url.searchParams.get('code') ?? '';
      // A short delay so the spinner state is observable, like a real request.
      setTimeout(() => {
        claims.push(code);
        let message = ZYN_LABELS.success;
        if (code.startsWith('BAD')) message = ZYN_LABELS.invalid;
        else if (claims.filter((claimed) => !claimed.startsWith('BAD')).length > monthlyCap) {
          message = ZYN_LABELS.limit;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message }));
      }, 150);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(PAGE_HTML);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    claims,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
