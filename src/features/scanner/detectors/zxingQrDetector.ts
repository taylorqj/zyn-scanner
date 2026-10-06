import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { QrDetection, QrDetector } from './types';

// Load the decoder from the extension package; the library's default is a CDN, which MV3 forbids.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
});

/** zxing-cpp compiled to WebAssembly. Slower than the native detector but works everywhere. */
export class ZxingQrDetector implements QrDetector {
  private readonly canvas = document.createElement('canvas');

  async detect(video: HTMLVideoElement): Promise<QrDetection[]> {
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return [];
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(video, 0, 0, width, height);

    const results = await readBarcodes(context.getImageData(0, 0, width, height), {
      formats: ['QRCode'],
      tryHarder: true,
      maxNumberOfSymbols: 4,
    });
    return results
      .filter((result) => result.isValid && result.text)
      .map((result) => ({
        text: result.text,
        corners: [
          result.position.topLeft,
          result.position.topRight,
          result.position.bottomRight,
          result.position.bottomLeft,
        ],
      }));
  }
}
