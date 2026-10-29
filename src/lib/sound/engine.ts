/**
 * The synthesizer behind lib/sound: every sound on the site is made here,
 * live, from oscillators and noise — no audio files, nothing to download
 * but this module, and only once a reader turns sound on.
 *
 * Two kinds of sound:
 * - Cues: short one-shots (a key, a click, the impact), each a small
 *   envelope over a node or two, scheduled on the audio clock and left to
 *   stop on their own.
 * - The black hole's voice: one continuous patch, built on its first
 *   frame, that the stage steers every frame it draws (`hole`). At rest it
 *   is a low drone with gas hissing round the disk, swelling with the
 *   camera's slow nod and panning with its drift. The heavier the hole
 *   (`mass`), the lower the drone; a hold adds a tone that climbs and
 *   opens up as the countdown runs; eating the hero brightens it all.
 *
 * Everything feeds a master gain → compressor, with a send to a generated
 * reverb for the sounds that should feel far away.
 */

export type Cue =
  | "on"
  | "off"
  | "hover"
  | "click"
  | "switch"
  | "key"
  | "enter"
  | "error"
  | "ok"
  | "open"
  | "close"
  | "notify"
  | "discover"
  /** A tap on the hole: a ring of light. */
  | "ping"
  /** The ring the disk sends out on its own, now and then. */
  | "ring"
  /** A hold begins. */
  | "arm"
  /** A second of the countdown goes; `amount` = how far through (0–1). */
  | "count"
  /** The countdown's last second: a heartbeat. */
  | "critical"
  | "cancel"
  /** A piece of the hero crossing the horizon. */
  | "grain"
  | "impact"
  /** The reboot: a kernel-log line, a typed key, a letter of the name, a
      line printed at console speed, and `[ ok ]`. */
  | "log"
  | "type"
  | "letter"
  | "print"
  | "restored"
  /** A project card dealt onto the table: a swish, then it lands. */
  | "deal"
  /** The next card slides fully over the last one in the stack. */
  | "stack"
  /** A notch of the scroll; `amount` < 0 going up. */
  | "notch"
  /** The reader scrolled into another section. */
  | "section";

export interface HoleState {
  /** How near the pointer is (0–1). */
  near: number;
  /** How far through the hold (0–1). */
  pull: number;
  /** How much of the hero it has eaten, fading after (0–1). */
  surge: number;
  /** The impact's afterglow (0–1). */
  flare: number;
  /** The hole's weight: 1 at rest, up to ~2. */
  mass: number;
  /** How fast a drag or flick is turning the camera (0–1). */
  spin: number;
  /** Where the camera's drift puts the disk, left to right (-1–1). */
  pan: number;
  /** The dark beat after the impact: 1 is silence. */
  hush: number;
}

export interface Engine {
  setEnabled(on: boolean): void;
  /** Resume a context the browser held back until a gesture. */
  unlock(): void;
  play(name: Cue, amount?: number): void;
  hole(state: HoleState): void;
  holeStop(): void;
  /** The page is scrolling this fast (px/s): air rushes with it. */
  scroll(speed: number): void;
}

const MASTER = 0.7;
/** Cues that can come in floods: the least time between two (s). */
const MIN_GAP: Partial<Record<Cue, number>> = {
  hover: 0.04,
  key: 0.018,
  type: 0.018,
  letter: 0.02,
  print: 0.03,
  grain: 0.014,
  log: 0.04,
  deal: 0.12,
  stack: 0.1,
  notch: 0.035,
  section: 0.25,
};
/** How fast the hole's voice follows the scene (time constant, s). */
const FOLLOW = 0.06;
/** A scroll this fast (px/s) is a full rush of air. */
const FULL_SCROLL = 3200;
/** The drone's root at rest (Hz): E1, felt more than heard. */
const ROOT = 41.2;

interface Voice {
  out: GainNode;
  pan: StereoPannerNode;
  drone: OscillatorNode[];
  droneGain: GainNode;
  droneFilter: BiquadFilterNode;
  gasFilter: BiquadFilterNode;
  gasGain: GainNode;
  tension: OscillatorNode;
  tensionFilter: BiquadFilterNode;
  tensionGain: GainNode;
}

interface Env {
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  /** Send to the reverb, 0–1. */
  wet?: number;
  pan?: number;
}

interface ToneSpec extends Env {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the decay. */
  to?: number;
  lowpass?: number;
}

interface NoiseSpec extends Env {
  filter?: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
}

function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

export function createEngine(): Engine {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 12;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.6, 3.2);
  const reverbIn = ctx.createGain();
  reverbIn.gain.value = 0.55;
  reverbIn.connect(reverb).connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.random() * 2 - 1;
  }

  let enabled = false;
  let voice: Voice | null = null;
  let suspendTimer = 0;
  const last = new Map<Cue, number>();

  /** An envelope out to the master (and the reverb); returns its input. */
  const envelope = ({ at, attack = 0.004, decay, gain, wet = 0, pan }: Env) => {
    const t = at ?? ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let tail: AudioNode = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      tail = p;
    }
    tail.connect(master);
    if (wet) {
      const send = ctx.createGain();
      send.gain.value = wet;
      tail.connect(send).connect(reverbIn);
    }
    return { input: g, start: t, end: t + attack + decay + 0.05 };
  };

  const tone = (spec: ToneSpec) => {
    const { input, start, end } = envelope(spec);
    const osc = ctx.createOscillator();
    osc.type = spec.type ?? "sine";
    osc.frequency.setValueAtTime(spec.freq, start);
    if (spec.to) {
      osc.frequency.exponentialRampToValueAtTime(
        spec.to,
        start + (spec.attack ?? 0.004) + spec.decay,
      );
    }
    if (spec.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = spec.lowpass;
      osc.connect(lp).connect(input);
    } else {
      osc.connect(input);
    }
    osc.start(start);
    osc.stop(end);
  };

  const hiss = (spec: NoiseSpec) => {
    const { input, start, end } = envelope(spec);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = spec.filter ?? "bandpass";
    filter.Q.value = spec.q ?? 1;
    filter.frequency.setValueAtTime(spec.freq, start);
    if (spec.to) {
      filter.frequency.exponentialRampToValueAtTime(
        spec.to,
        start + (spec.attack ?? 0.004) + spec.decay,
      );
    }
    src.connect(filter).connect(input);
    src.start(start, Math.random() * 1.5);
    src.stop(end);
  };

  const jitter = (x: number, amount = 0.06) =>
    x * (1 + (Math.random() * 2 - 1) * amount);

  const cues: Record<Cue, (amount: number, t: number) => void> = {
    on: (_, t) => {
      tone({ type: "triangle", freq: 440, decay: 0.08, gain: 0.12, at: t });
      tone({
        type: "triangle",
        freq: 880,
        decay: 0.16,
        gain: 0.1,
        at: t + 0.07,
      });
    },
    off: (_, t) => {
      tone({ type: "triangle", freq: 660, decay: 0.08, gain: 0.1, at: t });
      tone({
        type: "triangle",
        freq: 330,
        decay: 0.14,
        gain: 0.1,
        at: t + 0.07,
      });
    },
    hover: (_, t) => {
      hiss({ freq: jitter(5200, 0.1), q: 4, decay: 0.012, gain: 0.05, at: t });
    },
    click: (_, t) => {
      hiss({ freq: jitter(3200), q: 2, decay: 0.02, gain: 0.12, at: t });
      tone({
        type: "square",
        freq: 880,
        to: 440,
        decay: 0.04,
        gain: 0.035,
        lowpass: 2600,
        at: t,
      });
    },
    switch: (_, t) => {
      cues.click(1, t);
      tone({
        type: "square",
        freq: 1320,
        decay: 0.05,
        gain: 0.03,
        lowpass: 3000,
        at: t + 0.06,
      });
    },
    key: (_, t) => {
      hiss({
        freq: jitter(3000, 0.18),
        q: 1.6,
        decay: 0.018,
        gain: 0.11,
        at: t,
        pan: jitter(0, 1) * 0.2,
      });
      tone({ freq: jitter(170, 0.1), decay: 0.025, gain: 0.05, at: t });
    },
    enter: (_, t) => {
      hiss({ freq: 1600, q: 1.2, decay: 0.035, gain: 0.14, at: t });
      tone({ freq: 110, decay: 0.05, gain: 0.08, at: t });
    },
    error: (_, t) => {
      for (const k of [0, 1]) {
        tone({
          type: "square",
          freq: 140,
          decay: 0.07,
          gain: 0.06,
          lowpass: 1100,
          at: t + k * 0.1,
        });
      }
    },
    ok: (_, t) => {
      tone({ type: "triangle", freq: 880, decay: 0.06, gain: 0.07, at: t });
      tone({
        type: "triangle",
        freq: 1320,
        decay: 0.12,
        gain: 0.06,
        at: t + 0.055,
      });
    },
    open: (_, t) => {
      tone({
        type: "triangle",
        freq: 220,
        to: 880,
        attack: 0.02,
        decay: 0.16,
        gain: 0.07,
        at: t,
      });
      hiss({
        freq: 600,
        to: 4000,
        attack: 0.03,
        decay: 0.15,
        gain: 0.04,
        at: t,
      });
    },
    close: (_, t) => {
      tone({
        type: "triangle",
        freq: 880,
        to: 220,
        attack: 0.01,
        decay: 0.14,
        gain: 0.06,
        at: t,
      });
      hiss({ freq: 4000, to: 600, decay: 0.12, gain: 0.03, at: t });
    },
    notify: (_, t) => {
      tone({ freq: 1046, decay: 0.08, gain: 0.06, at: t, wet: 0.2 });
      tone({ freq: 1568, decay: 0.2, gain: 0.05, at: t + 0.07, wet: 0.2 });
    },
    discover: (_, t) => {
      [523, 659, 784, 1046].forEach((freq, i) => {
        tone({
          type: "triangle",
          freq,
          decay: 0.32,
          gain: 0.07,
          at: t + i * 0.07,
          wet: 0.45,
        });
      });
    },
    ping: (_, t) => {
      tone({
        freq: 520,
        to: 130,
        attack: 0.005,
        decay: 0.7,
        gain: 0.11,
        at: t,
        wet: 0.6,
      });
      tone({ freq: 62, to: 40, attack: 0.01, decay: 0.45, gain: 0.18, at: t });
    },
    ring: (amount, t) => {
      // Soft enough to live under the page: a swell more than a hit.
      hiss({
        filter: "lowpass",
        freq: 180,
        to: 1100,
        attack: 0.5,
        decay: 1.4,
        gain: 0.05,
        at: t,
        wet: 0.7,
        pan: amount,
      });
      tone({
        freq: 98,
        to: 62,
        attack: 0.25,
        decay: 1.4,
        gain: 0.05,
        at: t,
        wet: 0.5,
        pan: amount,
      });
    },
    arm: (_, t) => {
      tone({ freq: 55, to: 110, attack: 0.05, decay: 0.4, gain: 0.16, at: t });
      tone({
        type: "square",
        freq: 440,
        decay: 0.05,
        gain: 0.04,
        lowpass: 2000,
        at: t,
      });
    },
    count: (amount, t) => {
      const freq = 520 + 360 * amount;
      tone({
        type: "square",
        freq,
        decay: 0.08,
        gain: 0.06,
        lowpass: 2400,
        at: t,
        wet: 0.15,
      });
    },
    critical: (_, t) => {
      tone({ freq: 74, to: 40, attack: 0.004, decay: 0.16, gain: 0.22, at: t });
      tone({
        freq: 74,
        to: 40,
        attack: 0.004,
        decay: 0.12,
        gain: 0.14,
        at: t + 0.14,
      });
    },
    cancel: (_, t) => {
      tone({
        type: "sawtooth",
        freq: 420,
        to: 70,
        attack: 0.01,
        decay: 0.42,
        gain: 0.06,
        lowpass: 1400,
        at: t,
      });
      hiss({ freq: 2400, to: 300, decay: 0.38, gain: 0.05, at: t, wet: 0.3 });
    },
    grain: (amount, t) => {
      hiss({
        freq: jitter(900 + 4200 * amount, 0.35),
        q: 3,
        decay: 0.006 + Math.random() * 0.02,
        gain: 0.025 + 0.04 * Math.random(),
        at: t,
        pan: Math.random() * 1.6 - 0.8,
        wet: 0.3,
      });
    },
    impact: (_, t) => {
      tone({ freq: 96, to: 26, attack: 0.004, decay: 1.6, gain: 0.55, at: t });
      tone({
        type: "sawtooth",
        freq: 48,
        to: 30,
        attack: 0.004,
        decay: 0.7,
        gain: 0.08,
        lowpass: 240,
        at: t,
      });
      hiss({
        filter: "lowpass",
        freq: 2600,
        to: 90,
        attack: 0.003,
        decay: 1.4,
        gain: 0.32,
        at: t,
        wet: 0.8,
      });
      hiss({ filter: "highpass", freq: 3000, decay: 0.05, gain: 0.18, at: t });
    },
    log: (_, t) => {
      tone({
        type: "square",
        freq: 1250,
        decay: 0.022,
        gain: 0.035,
        lowpass: 3200,
        at: t,
      });
    },
    type: (_, t) => cues.key(1, t),
    letter: (_, t) => {
      hiss({ freq: jitter(3600, 0.12), q: 2, decay: 0.014, gain: 0.08, at: t });
    },
    print: (_, t) => {
      hiss({ freq: jitter(4800, 0.2), q: 3, decay: 0.008, gain: 0.05, at: t });
    },
    restored: (_, t) => {
      [784, 1175, 1568].forEach((freq, i) => {
        tone({ freq, decay: 0.5, gain: 0.06, at: t + i * 0.06, wet: 0.5 });
      });
    },
    deal: (_, t) => {
      // Timed to the card's entrance (globals.css scene-card, expo out):
      // it flies most of the way in the first 0.3 s and lands.
      hiss({
        freq: 500,
        to: 3800,
        attack: 0.12,
        decay: 0.2,
        gain: 0.07,
        q: 0.8,
        at: t,
        pan: -0.15,
      });
      hiss({
        filter: "lowpass",
        freq: 900,
        to: 160,
        decay: 0.09,
        gain: 0.16,
        at: t + 0.26,
      });
      tone({ freq: 120, to: 70, decay: 0.08, gain: 0.12, at: t + 0.26 });
      // The cover opening.
      tone({
        type: "triangle",
        freq: 660,
        to: 990,
        attack: 0.08,
        decay: 0.3,
        gain: 0.025,
        at: t + 0.3,
        wet: 0.35,
      });
    },
    stack: (_, t) => {
      tone({ freq: 90, to: 48, decay: 0.16, gain: 0.16, at: t });
      hiss({
        filter: "lowpass",
        freq: 600,
        to: 120,
        decay: 0.12,
        gain: 0.08,
        at: t,
      });
    },
    notch: (amount, t) => {
      const freq = amount < 0 ? 1500 : 1900;
      tone({ freq: jitter(freq, 0.03), decay: 0.012, gain: 0.018, at: t });
      hiss({ freq: 6000, q: 3, decay: 0.006, gain: 0.025, at: t });
    },
    section: (_, t) => {
      tone({
        type: "square",
        freq: 440,
        decay: 0.04,
        gain: 0.03,
        lowpass: 2000,
        at: t,
      });
      tone({
        type: "square",
        freq: 660,
        decay: 0.07,
        gain: 0.03,
        lowpass: 2000,
        at: t + 0.05,
      });
    },
  };

  let air: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  const buildAir = () => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { filter, gain };
  };

  const buildVoice = (): Voice => {
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner();
    out.connect(pan).connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.3;
    pan.connect(send).connect(reverbIn);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.frequency.value = 180;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneFilter.connect(droneGain).connect(out);
    // Two sines a hair apart beat slowly against each other; the
    // triangle an octave up gives a small phone speaker something to play.
    const drone = (
      [
        ["sine", 1],
        ["sine", 1.01],
        ["triangle", 2],
      ] as const
    ).map(([type, ratio]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = ROOT * ratio;
      osc.connect(droneFilter);
      osc.start();
      return osc;
    });

    // Gas round the disk: noise through a moving band.
    const gas = ctx.createBufferSource();
    gas.buffer = noise;
    gas.loop = true;
    const gasFilter = ctx.createBiquadFilter();
    gasFilter.type = "bandpass";
    gasFilter.Q.value = 0.9;
    gasFilter.frequency.value = 300;
    const gasGain = ctx.createGain();
    gasGain.gain.value = 0;
    // It swells with the camera's slow nod (idleView: sin(0.23 t)).
    const swell = ctx.createGain();
    swell.gain.value = 0.7;
    const nod = ctx.createOscillator();
    nod.frequency.value = 0.23 / (2 * Math.PI);
    const nodDepth = ctx.createGain();
    nodDepth.gain.value = 0.3;
    nod.connect(nodDepth).connect(swell.gain);
    gas.connect(gasFilter).connect(swell).connect(gasGain).connect(out);
    gas.start();
    nod.start();

    // The hold: a tone that climbs and opens as the countdown runs.
    const tension = ctx.createOscillator();
    tension.type = "sawtooth";
    tension.frequency.value = ROOT * 2;
    const tensionFilter = ctx.createBiquadFilter();
    tensionFilter.Q.value = 7;
    tensionFilter.frequency.value = 150;
    const tensionGain = ctx.createGain();
    tensionGain.gain.value = 0;
    tension.connect(tensionFilter).connect(tensionGain).connect(out);
    tension.start();

    return {
      out,
      pan,
      drone,
      droneGain,
      droneFilter,
      gasFilter,
      gasGain,
      tension,
      tensionFilter,
      tensionGain,
    };
  };

  const follow = (param: AudioParam, value: number, tc = FOLLOW) => {
    param.setTargetAtTime(value, ctx.currentTime, tc);
  };

  const engine: Engine = {
    setEnabled(on) {
      enabled = on;
      window.clearTimeout(suspendTimer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      if (on) {
        void ctx.resume().catch(() => {});
        follow(master.gain, MASTER, 0.05);
      } else {
        // Faded a moment later, so a last blip still sounds.
        master.gain.setTargetAtTime(0, ctx.currentTime + 0.2, 0.05);
        // After the fade (and the "off" blip): no audio thread left running.
        suspendTimer = window.setTimeout(() => {
          void ctx.suspend().catch(() => {});
        }, 400);
      }
    },

    unlock() {
      if (enabled && ctx.state !== "running") {
        void ctx.resume().catch(() => {});
      }
    },

    play(name, amount = 1) {
      if (!enabled) return;
      if (ctx.state !== "running") {
        // Still waking (sound just turned on): play it once it is up, if
        // that is soon enough to still belong to what caused it.
        const asked = performance.now();
        void ctx
          .resume()
          .then(() => {
            if (performance.now() - asked < 300) engine.play(name, amount);
          })
          .catch(() => {});
        return;
      }
      const now = ctx.currentTime;
      const gap = MIN_GAP[name];
      if (gap && now - (last.get(name) ?? -1) < gap) return;
      last.set(name, now);
      cues[name](amount, now);
    },

    hole(s) {
      if (!enabled || ctx.state !== "running") return;
      voice ??= buildVoice();
      const v = voice;
      const quiet = 1 - s.hush;
      follow(v.out.gain, quiet, 0.15);
      follow(v.pan.pan, s.pan * 0.45, 0.4);

      // Heavier is lower.
      const root = ROOT / Math.sqrt(s.mass);
      v.drone.forEach((osc, i) => {
        follow(osc.frequency, root * (i === 0 ? 1 : i === 1 ? 1.01 : 2));
      });
      follow(
        v.droneGain.gain,
        0.045 + 0.05 * s.near + 0.24 * s.pull + 0.25 * s.surge + 0.2 * s.flare,
      );
      follow(
        v.droneFilter.frequency,
        160 + 380 * s.near + 600 * s.pull + 900 * s.surge + 2200 * s.flare,
      );

      follow(
        v.gasFilter.frequency,
        240 + 700 * s.spin + 900 * s.pull + 1400 * s.surge,
      );
      follow(
        v.gasGain.gain,
        0.012 + 0.025 * s.near + 0.1 * s.spin + 0.08 * s.pull + 0.14 * s.surge,
      );

      const climb = Math.pow(s.pull, 1.5);
      follow(v.tension.frequency, ROOT * 2 * Math.pow(2, 2.6 * s.pull));
      follow(v.tensionFilter.frequency, 150 + 3200 * climb);
      follow(v.tensionGain.gain, 0.08 * climb + 0.05 * s.surge);
    },

    holeStop() {
      if (voice) follow(voice.out.gain, 0, 0.25);
    },

    scroll(speed) {
      if (!enabled || ctx.state !== "running") return;
      air ??= buildAir();
      const k = Math.min(1, speed / FULL_SCROLL);
      const now = ctx.currentTime;
      // Up to this speed now, and dying away unless the next event keeps
      // it up: no frame loop needed to let it settle.
      for (const [param, value, rest] of [
        [air.gain.gain, 0.06 * Math.pow(k, 1.3), 0],
        [air.filter.frequency, 350 + 2600 * k, 350],
      ] as const) {
        param.cancelScheduledValues(now);
        param.setTargetAtTime(value, now, 0.04);
        param.setTargetAtTime(rest, now + 0.08, 0.14);
      }
    },
  };
  return engine;
}
