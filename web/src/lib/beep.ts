// Short tones for hands-free capture (countdown and shutter).
let audio: AudioContext | null = null;

export function beep(freq = 660, seconds = 0.12) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + seconds);
  } catch {
    /* no audio, no beep */
  }
}
