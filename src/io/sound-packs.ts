/**
 * Keyboard sound packs. All remaining packs are synthesised on the fly
 * with Web Audio — zero bundled assets and zero network fetches.
 *
 * Each category gets a slightly different envelope so Tab / Enter /
 * Esc / Space feel distinct without being jarring.
 */

export type SoundCategory = "default" | "tab" | "enter" | "esc" | "space";

export const SOUND_CATEGORIES: readonly SoundCategory[] = [
  "default",
  "tab",
  "enter",
  "esc",
  "space",
];

interface NoiseConfig {
  /** Burst duration in milliseconds. */
  durationMs: number;
  /** Filter shape. */
  filter: BiquadFilterType;
  /** Centre / cutoff frequency in Hz. */
  freq: number;
  /** Filter Q. Higher = more peaky / ringy. */
  q: number;
  /** Peak gain 0..1 applied at attack apex. */
  peak: number;
}

interface OscConfig {
  /** Waveform. */
  type: OscillatorType;
  /** Frequency in Hz. */
  freq: number;
  /** Decay duration in milliseconds. */
  durationMs: number;
  /** Peak gain 0..1 applied at attack apex. */
  peak: number;
}

export interface SynthConfig {
  /** Filtered noise burst — the "click" / "ring" component. */
  noise?: NoiseConfig;
  /** Optional decaying oscillator — the "body" / "thock" component. */
  osc?: OscConfig;
}

export interface SynthPackData {
  readonly kind: "synth";
  /** Stable id used in localStorage and settings labels. */
  name: string;
  /** Display label. */
  label: string;
  /** Per-category configs. `default` is required; others fall back to it. */
  sounds: Partial<Record<SoundCategory, SynthConfig>> & { default: SynthConfig };
}

export type KeySoundPackData = SynthPackData;

/* ───────────────────────── pack data ─────────────────────────── */

const MECHVIBE: SynthPackData = {
  kind: "synth",
  name: "mechvibe",
  label: "mechvibe",
  sounds: {
    default: {
      noise: { durationMs: 50, filter: "bandpass", freq: 3000, q: 1.5, peak: 0.4 },
      osc: { type: "sine", freq: 90, durationMs: 60, peak: 0.15 },
    },
    tab: {
      noise: { durationMs: 60, filter: "bandpass", freq: 2400, q: 1.5, peak: 0.45 },
      osc: { type: "sine", freq: 75, durationMs: 70, peak: 0.18 },
    },
    enter: {
      noise: { durationMs: 70, filter: "bandpass", freq: 2200, q: 2, peak: 0.5 },
      osc: { type: "sine", freq: 70, durationMs: 90, peak: 0.22 },
    },
    esc: {
      // Light, bright tick — no body.
      noise: { durationMs: 40, filter: "bandpass", freq: 3500, q: 1.5, peak: 0.35 },
    },
    space: {
      // Wide, low spacebar kachunk.
      noise: { durationMs: 70, filter: "bandpass", freq: 1800, q: 1.0, peak: 0.45 },
      osc: { type: "sine", freq: 60, durationMs: 95, peak: 0.22 },
    },
  },
};

const SOFT: SynthPackData = {
  kind: "synth",
  name: "soft",
  label: "soft",
  sounds: {
    default: {
      noise: { durationMs: 35, filter: "lowpass", freq: 1200, q: 1, peak: 0.25 },
    },
    tab: {
      noise: { durationMs: 40, filter: "lowpass", freq: 1000, q: 1, peak: 0.28 },
    },
    enter: {
      noise: { durationMs: 50, filter: "lowpass", freq: 800, q: 1, peak: 0.32 },
    },
    esc: {
      noise: { durationMs: 25, filter: "lowpass", freq: 1500, q: 1, peak: 0.22 },
    },
    space: {
      noise: { durationMs: 50, filter: "lowpass", freq: 900, q: 1, peak: 0.32 },
    },
  },
};

const OFF: SynthPackData = {
  kind: "synth",
  name: "off",
  label: "off",
  // Empty noise spec → no audio nodes created → silence.
  sounds: { default: {} },
};

export const KEY_SOUND_PACKS: readonly KeySoundPackData[] = [OFF, MECHVIBE, SOFT];

export function findPack(name: string): KeySoundPackData | null {
  return KEY_SOUND_PACKS.find((p) => p.name === name) ?? null;
}

/* ───────────────────────── synthesis ────────────────────────── */

/**
 * Build a short white-noise buffer. Cheap: ~50 ms × 44.1 kHz = ~2200 floats.
 * We allocate per click — that's fine at typing speed; pool if a profiler
 * ever points here.
 */
function makeNoiseBuffer(ctx: BaseAudioContext, durationMs: number): AudioBuffer {
  const length = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * If `pan` is non-zero and the runtime supports StereoPannerNode (every
 * browser since 2014), returns a freshly-created panner connected to
 * `dest` — callers connect their per-keystroke graph INTO the returned
 * node so the panner sits between the source and the destination. Pan
 * value is clamped to [-1, +1]. If `pan === 0`, returns `dest` directly
 * so no extra node is allocated for centre-positioned keystrokes (the
 * common case: Space, modifier-less keys, unknown codes).
 */
function destinationWithPan(ctx: AudioContext, dest: AudioNode, pan: number): AudioNode {
  if (pan === 0 || typeof ctx.createStereoPanner !== "function") return dest;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
  panner.connect(dest);
  return panner;
}

function playNoiseBurst(ctx: AudioContext, dest: AudioNode, cfg: NoiseConfig, pan: number): void {
  const out = destinationWithPan(ctx, dest, pan);
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, cfg.durationMs);
  const filter = ctx.createBiquadFilter();
  filter.type = cfg.filter;
  filter.frequency.value = cfg.freq;
  filter.Q.value = cfg.q;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const end = now + cfg.durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cfg.peak, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(filter).connect(gain).connect(out);
  src.start(now);
  src.stop(end + 0.02);
}

function playOscBurst(ctx: AudioContext, dest: AudioNode, cfg: OscConfig, pan: number): void {
  const out = destinationWithPan(ctx, dest, pan);
  const osc = ctx.createOscillator();
  osc.type = cfg.type;
  osc.frequency.value = cfg.freq;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const end = now + cfg.durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cfg.peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(end + 0.02);
}

export interface KeySoundPack {
  /** Stable id, matches `KeySoundPackData.name`. */
  name: string;
  /** Display label. */
  label: string;
  /**
   * Play one click for the given category, optionally panned. `pan` is the
   * stereo position in [-1, +1] (-1 = full left, 0 = centre, +1 = full
   * right). Callers source it from `panForCode(event.code)` in key-sounds.
   */
  play(category: SoundCategory, pan?: number): void;
}

/**
 * Instantiate a playable pack on a specific AudioContext. The returned
 * pack closes over the context and destination; switching packs at
 * runtime is "discard the old, create a new one against the same context".
 */
export function createPack(
  data: KeySoundPackData,
  ctx: AudioContext,
  destination: AudioNode,
): KeySoundPack {
  return createSynthPack(data, ctx, destination);
}

function createSynthPack(
  data: SynthPackData,
  ctx: AudioContext,
  destination: AudioNode,
): KeySoundPack {
  return {
    name: data.name,
    label: data.label,
    play(category, pan = 0) {
      const config = data.sounds[category] ?? data.sounds.default;
      if (config.noise) playNoiseBurst(ctx, destination, config.noise, pan);
      if (config.osc) playOscBurst(ctx, destination, config.osc, pan);
    },
  };
}
