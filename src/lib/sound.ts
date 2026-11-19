// Tiny synthesized sound effects (Web Audio, no files).
export type Sound = "merge" | "new" | "fizzle" | "win" | "reset";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export const setMuted = (m: boolean) => {
  muted = m;
};

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// one oscillator note with a pitch slide and a quick fade
function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// short filtered noise burst (puffs and whooshes)
function noise(c: AudioContext, at: number, dur: number, vol: number, f0: number, f1: number) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  const t = c.currentTime + at;
  src.buffer = buf;
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

export function play(kind: Sound, brainrot = false) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  switch (kind) {
    case "merge":
      tone(c, "sine", 360, 760, 0, 0.16, 0.5);
      tone(c, "triangle", 720, 1500, 0.01, 0.1, 0.12);
      break;
    case "new":
      tone(c, "sine", 360, 760, 0, 0.16, 0.5);
      tone(c, "triangle", 1320, 1320, 0.1, 0.14, 0.18);
      tone(c, "triangle", 1760, 1760, 0.18, 0.2, 0.16);
      break;
    case "fizzle":
      if (brainrot) {
        // deep "boom"
        tone(c, "sine", 140, 38, 0, 0.7, 0.9);
        tone(c, "triangle", 90, 30, 0, 0.45, 0.35);
        noise(c, 0, 0.18, 0.25, 400, 120);
      } else {
        tone(c, "triangle", 220, 110, 0, 0.2, 0.3);
        noise(c, 0, 0.25, 0.18, 900, 300);
      }
      break;
    case "win": {
      const notes = brainrot ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
      notes.forEach((f, i) => tone(c, "triangle", f, f, i * 0.09, 0.5, 0.28));
      tone(c, "sine", 1047, 1047, notes.length * 0.09, 0.9, 0.18);
      break;
    }
    case "reset":
      noise(c, 0, 0.35, 0.2, 300, 2400);
      break;
  }
}
