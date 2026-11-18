// Floating emoji behind the brainrot board (seeded so server and client match).
const EMOJI = ["💀", "🔥", "🗿", "😭", "🧠", "💅", "🤑", "👀", "🥀", "✨", "🫠", "😤"];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(67);
const r2 = (x: number) => Math.round(x * 100) / 100;
const BITS = Array.from({ length: 22 }, (_, i) => ({
  e: EMOJI[i % EMOJI.length],
  left: r2(rand() * 100),
  top: r2(rand() * 100),
  size: r2(18 + rand() * 22),
  spin: r2(-25 + rand() * 50),
  delay: r2(rand() * -12),
  dur: r2(9 + rand() * 9),
}));

export default function BrainrotSky() {
  return (
    <div className="rot-sky" aria-hidden>
      {BITS.map((b, i) => (
        <span
          key={i}
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            fontSize: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ["--spin" as string]: `${b.spin}deg`,
          }}
        >
          {b.e}
        </span>
      ))}
    </div>
  );
}
