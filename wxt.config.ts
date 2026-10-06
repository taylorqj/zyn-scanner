import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // A visible folder: macOS file pickers hide dot-folders, which makes "Load unpacked" a hunt.
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Zyn Scanner',
    description:
      'Scan Zyn can QR codes with your webcam and redeem them on your logged-in Zyn Rewards page.',
    permissions: ['storage', 'alarms'],
    action: { default_title: 'Open Zyn Scanner' },
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+Z' } },
    },
    // zxing-wasm (the QR fallback when Chrome has no native BarcodeDetector) needs wasm-unsafe-eval.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
