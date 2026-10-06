export interface QrDetection {
  text: string;
  /** Corners of the code in video pixels, clockwise from top-left. */
  corners: { x: number; y: number }[];
}

export interface QrDetector {
  detect(video: HTMLVideoElement): Promise<QrDetection[]>;
}
