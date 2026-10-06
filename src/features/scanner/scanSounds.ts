let audioContext: AudioContext | undefined;

function playTone(frequency: number, durationMs: number, delayMs = 0, type: OscillatorType = 'sine') {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const startAt = audioContext.currentTime + delayMs / 1000;
    const endAt = startAt + durationMs / 1000;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, endAt);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  } catch {
    // Sound is a nicety; the on-screen feedback carries the same information.
  }
}

export const scanSounds = {
  accepted: () => playTone(880, 110),
  duplicate: () => {
    playTone(440, 80);
    playTone(440, 80, 120);
  },
  unrecognized: () => playTone(196, 220, 0, 'square'),
  credited: () => {
    playTone(1319, 90);
    playTone(1760, 160, 90);
  },
};
