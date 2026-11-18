"use client";

import { useEffect, useState } from "react";
import { msUntilLocalMidnight } from "@/lib/date";

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilLocalMidnight());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (ms == null) return null;
  if (ms < 1500)
    return (
      <button className="btn" onClick={() => window.location.assign(window.location.pathname)}>
        A new brew is ready!
      </button>
    );
  const s = Math.floor(ms / 1000);
  return (
    <span className="countdown">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}
