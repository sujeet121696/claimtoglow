// Short tones for hands-free capture (countdown and shutter).
let audio: AudioContext | null = null;

/** Phones (iOS) only let sound start inside a tap: call this from one so later beeps play. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio, no beep */
  }
}

export function beep(freq = 660, seconds = 0.12) {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
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
