// ===== SOUND EFFECTS (Web Audio, sintetizzati — nessun asset richiesto) =====
// Tutti i suoni passano da un unico flag "audio attivo" persistito in localStorage.

const LS_SOUND_KEY = 'briscola_sound_enabled';

let soundEnabled: boolean | null = null;

export const isSoundEnabled = (): boolean => {
  if (soundEnabled === null) {
    if (typeof window === 'undefined') return true;
    try {
      soundEnabled = localStorage.getItem(LS_SOUND_KEY) !== 'false';
    } catch {
      soundEnabled = true;
    }
  }
  return soundEnabled;
};

export const setSoundEnabled = (enabled: boolean): void => {
  soundEnabled = enabled;
  try {
    localStorage.setItem(LS_SOUND_KEY, String(enabled));
  } catch {}
};

let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
};

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

/** Suona una nota: freq in Hz, offset e durata in secondi. */
const tone = (
  ctx: AudioContext,
  freq: number,
  offset: number,
  duration: number,
  { type = 'sine', gain = 0.07, glideTo }: ToneOptions = {}
): void => {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const t0 = ctx.currentTime + offset;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  }

  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

const withCtx = (fn: (ctx: AudioContext) => void): void => {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    fn(ctx);
  } catch {}
};

/** Doppio "ding" morbido: è il tuo turno. */
export const playTurnSound = (): void =>
  withCtx(ctx => {
    tone(ctx, 660, 0, 0.14, { type: 'triangle', gain: 0.06 });
    tone(ctx, 880, 0.11, 0.2, { type: 'triangle', gain: 0.06 });
  });

/** Terzina ascendente: presa vinta. */
export const playTrickWonSound = (): void =>
  withCtx(ctx => {
    tone(ctx, 523.25, 0, 0.11, { type: 'triangle', gain: 0.05 });
    tone(ctx, 659.25, 0.09, 0.11, { type: 'triangle', gain: 0.05 });
    tone(ctx, 783.99, 0.18, 0.18, { type: 'triangle', gain: 0.05 });
  });

/** Coppia discendente sommessa: presa persa. */
export const playTrickLostSound = (): void =>
  withCtx(ctx => {
    tone(ctx, 392, 0, 0.12, { type: 'sine', gain: 0.035 });
    tone(ctx, 311.13, 0.1, 0.18, { type: 'sine', gain: 0.035 });
  });

/** Arpeggio maggiore: vittoria. */
export const playVictorySound = (): void =>
  withCtx(ctx => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(ctx, f, i * 0.13, 0.28, { type: 'triangle', gain: 0.06 }));
    tone(ctx, 1318.5, 0.52, 0.5, { type: 'triangle', gain: 0.05 });
  });

/** Discesa lenta: sconfitta. */
export const playDefeatSound = (): void =>
  withCtx(ctx => {
    const notes = [493.88, 440, 392, 329.63];
    notes.forEach((f, i) => tone(ctx, f, i * 0.16, 0.3, { type: 'sine', gain: 0.045 }));
  });

/** Chime neutro: fine smazzata / pareggio. */
export const playNeutralChime = (): void =>
  withCtx(ctx => {
    tone(ctx, 587.33, 0, 0.18, { type: 'triangle', gain: 0.05 });
    tone(ctx, 587.33, 0.2, 0.26, { type: 'triangle', gain: 0.05 });
  });

/** Tick secco per il countdown in scadenza. */
export const playTickSound = (): void =>
  withCtx(ctx => {
    tone(ctx, 1200, 0, 0.05, { type: 'square', gain: 0.025, glideTo: 900 });
  });

/** Vibrazione (solo dispositivi che la supportano); rispetta il flag audio. */
export const vibrate = (pattern: number | number[]): void => {
  if (!isSoundEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
};
