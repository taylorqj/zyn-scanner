import type { QrDetection, QrDetector } from './types';

/** Chrome's built-in BarcodeDetector (backed by the Vision framework on macOS). */
export class NativeQrDetector implements QrDetector {
  private readonly detector = new BarcodeDetector({ formats: ['qr_code'] });

  static async isSupported(): Promise<boolean> {
    if (!('BarcodeDetector' in globalThis)) return false;
    try {
      return (await BarcodeDetector.getSupportedFormats()).includes('qr_code');
    } catch {
      return false;
    }
  }

  async detect(video: HTMLVideoElement): Promise<QrDetection[]> {
    const barcodes = await this.detector.detect(video);
    return barcodes
      .filter((barcode) => barcode.rawValue)
      .map((barcode) => ({ text: barcode.rawValue, corners: barcode.cornerPoints }));
  }
}
