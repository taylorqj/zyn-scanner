import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const WIDTH = 640;
const HEIGHT = 480;
const FRAME_RATE = 10;
const WHITE = 235;
const BLACK = 16;
const GREY = 128;

/**
 * Writes an uncompressed Y4M video that shows each QR code in turn, with blank frames in between,
 * for Chrome's `--use-file-for-fake-video-capture` flag. Chrome loops the file.
 */
export function writeQrVideo(
  path: string,
  texts: string[],
  { framesPerCode = 15, blankFrames = 8 } = {},
): void {
  const chunks: Uint8Array[] = [Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FRAME_RATE}:1 Ip A1:1 C420jpeg\n`)];
  const blank = frameOf(null);
  for (const text of texts) {
    const frame = frameOf(text);
    for (let i = 0; i < framesPerCode; i += 1) chunks.push(frame);
    for (let i = 0; i < blankFrames; i += 1) chunks.push(blank);
  }
  writeFileSync(path, Buffer.concat(chunks));
}

function frameOf(text: string | null): Uint8Array {
  const luma = Buffer.alloc(WIDTH * HEIGHT, text ? WHITE : GREY);
  if (text) {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const scale = Math.floor((Math.min(WIDTH, HEIGHT) * 0.7) / modules.size);
    const left = Math.floor((WIDTH - modules.size * scale) / 2);
    const top = Math.floor((HEIGHT - modules.size * scale) / 2);
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (!modules.get(row, col)) continue;
        for (let y = 0; y < scale; y += 1) {
          const offset = (top + row * scale + y) * WIDTH + left + col * scale;
          luma.fill(BLACK, offset, offset + scale);
        }
      }
    }
  }
  const chroma = Buffer.alloc((WIDTH * HEIGHT) / 2, 128);
  return Buffer.concat([Buffer.from('FRAME\n'), luma, chroma]);
}
