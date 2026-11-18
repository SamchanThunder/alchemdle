// Seeded star field (same on server and client).
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1729);
const r2 = (x: number) => Math.round(x * 100) / 100;
const STARS = Array.from({ length: 70 }, (_, i) => ({
  left: r2(rand() * 100),
  top: r2(rand() * 100),
  size: r2(rand() < 0.85 ? 1 + rand() * 2 : 3 + rand() * 2),
  delay: r2(rand() * 6),
  dur: r2(2.5 + rand() * 4),
  glint: i % 9 === 0,
}));

export default function Sparkles() {
  return (
    <div className="sky" aria-hidden>
      <div className="moon" />
      {STARS.map((s, i) =>
        s.glint ? (
          <span
            key={i}
            className="glint"
            style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur + 2}s` }}
          >
            ✦
          </span>
        ) : (
          <span
            key={i}
            className="star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ),
      )}
    </div>
  );
}
