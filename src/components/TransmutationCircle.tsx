"use client";

import { useEffect, useRef } from "react";

// Decorative alchemy circle behind the board.

const PLANETS = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "☉", "☽", "☿", "♀", "♂", "♃", "♄"];

// Element symbols: fire, air, water, earth.
function ElementGlyph({ angle, up, bar }: { angle: number; up: boolean; bar: boolean }) {
  const r = 300;
  const cx = 400 + r * Math.cos((angle * Math.PI) / 180);
  const cy = 400 + r * Math.sin((angle * Math.PI) / 180);
  const s = 22;
  const pts = up
    ? `${cx},${cy - s} ${cx + s * 0.9},${cy + s * 0.6} ${cx - s * 0.9},${cy + s * 0.6}`
    : `${cx},${cy + s} ${cx + s * 0.9},${cy - s * 0.6} ${cx - s * 0.9},${cy - s * 0.6}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={s + 12} className="tc-fill" />
      <circle cx={cx} cy={cy} r={s + 12} />
      <polygon points={pts} />
      {bar && <line x1={cx - s * 0.75} x2={cx + s * 0.75} y1={cy + (up ? 4 : -4)} y2={cy + (up ? 4 : -4)} />}
    </g>
  );
}

export default function TransmutationCircle({ flash }: { flash: number }) {
  // Toggle a class so the spinning ring doesn't reset.
  const art = useRef<SVGGElement>(null);
  useEffect(() => {
    const g = art.current;
    if (!flash || !g) return;
    g.classList.remove("tc-flash");
    void g.getBoundingClientRect();
    g.classList.add("tc-flash");
    const t = window.setTimeout(() => g.classList.remove("tc-flash"), 900);
    return () => window.clearTimeout(t);
  }, [flash]);
  const hex = (r: number, rot: number) =>
    Array.from({ length: 3 }, (_, i) => {
      const a = ((rot + i * 120) * Math.PI) / 180;
      return `${400 + r * Math.cos(a)},${400 + r * Math.sin(a)}`;
    }).join(" ");
  return (
    <svg className="tc" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <path id="tc-rune-path" d="M400,400 m-355,0 a355,355 0 1,1 710,0 a355,355 0 1,1 -710,0" />
      </defs>
      <g ref={art} className="tc-art">
        <g className="tc-spin">
          <circle cx="400" cy="400" r="385" />
          <circle cx="400" cy="400" r="372" className="tc-thin" />
          <circle cx="400" cy="400" r="336" className="tc-thin" />
          <text className="tc-runes">
            <textPath href="#tc-rune-path" startOffset="0" textLength="2200">
              {PLANETS.map((p) => `${p}︎`).join("   ✦   ")}
            </textPath>
          </text>
        </g>
        <circle cx="400" cy="400" r="300" className="tc-thin" />
        <polygon points={hex(300, -90)} />
        <polygon points={hex(300, 90)} />
        <rect x="250" y="250" width="300" height="300" transform="rotate(45 400 400)" className="tc-thin" />
        <circle cx="400" cy="400" r="150" />
        <circle cx="400" cy="400" r="138" className="tc-thin" />
        <circle cx="400" cy="400" r="58" />
        <circle cx="400" cy="400" r="10" className="tc-dot" />
        {[0, 45, 90, 135].map((a) => (
          <line
            key={a}
            className="tc-thin"
            x1={400 + 58 * Math.cos((a * Math.PI) / 180)}
            y1={400 + 58 * Math.sin((a * Math.PI) / 180)}
            x2={400 - 58 * Math.cos((a * Math.PI) / 180)}
            y2={400 - 58 * Math.sin((a * Math.PI) / 180)}
          />
        ))}
        <ElementGlyph angle={-90} up bar={false} />
        <ElementGlyph angle={0} up bar />
        <ElementGlyph angle={90} up={false} bar={false} />
        <ElementGlyph angle={180} up={false} bar />
      </g>
    </svg>
  );
}
