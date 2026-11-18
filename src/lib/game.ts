import type { LogEntry, PuzzleBundle, Run, Tok } from "./types";

const K = 1 << 13;
export const pairKey = (x: number, y: number) => (x <= y ? x * K + y : y * K + x);

export function reactionTable(p: PuzzleBundle): Map<number, number> {
  const m = new Map<number, number>();
  for (const [a, b, r] of p.reactions) m.set(a * K + b, r);
  return m;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Starting spots (0-1 fractions): a ring if it fits, else a loose grid. */
export function scatter(n: number, w: number, h: number, seed: number): { x: number; y: number }[] {
  const rnd = mulberry32(seed);
  const rx = 0.36;
  const ry = 0.34;
  const a = rx * w;
  const b = ry * h;
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  if (n > 1 && perimeter / n >= 104 && b >= 80) {
    const off = -Math.PI / 2 + (rnd() - 0.5) * 0.4;
    return Array.from({ length: n }, (_, i) => {
      const t = off + (i * 2 * Math.PI) / n + (rnd() - 0.5) * 0.18;
      return { x: 0.5 + rx * Math.cos(t), y: 0.5 + ry * Math.sin(t) };
    });
  }
  const cols = Math.max(1, Math.min(n, Math.floor(w / 100)));
  const rows = Math.ceil(n / cols);
  const cellW = w / cols;
  const cellH = Math.min(h / rows, 150);
  const top = (h - cellH * rows) / 2;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    const left = (w - inRow * cellW) / 2;
    const x = left + (c + 0.5) * cellW + (rnd() - 0.5) * cellW * 0.22;
    const y = top + (r + 0.5) * cellH + (rnd() - 0.5) * cellH * 0.18;
    return { x: x / w, y: y / h };
  });
}

export function freshBoard(tokens: number[], startUid: number, w: number, h: number): Tok[] {
  const pos = scatter(tokens.length, w, h, startUid * 7919 + tokens.length);
  return tokens.map((id, i) => ({ uid: startUid + i, id, ...pos[i] }));
}

export function newRun(p: PuzzleBundle, w: number, h: number): Run {
  return {
    board: freshBoard(p.tokens, 1, w, h),
    merges: 0,
    fizzles: 0,
    log: [],
    discovered: [],
    won: false,
    winUid: null,
    nextUid: p.tokens.length + 1,
  };
}

/** Is there any pair on the board that reacts? (Self-pairs need two copies.) */
export function hasMoves(board: Tok[], table: Map<number, number>): boolean {
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      if (table.has(pairKey(board[i].id, board[j].id))) return true;
  return false;
}

/** Indices of log entries that fed into the winning token. */
export function contributingMerges(log: LogEntry[], winUid: number | null): Set<number> {
  const creator = new Map<number, number>();
  log.forEach((e, i) => {
    if (!("reset" in e)) creator.set(e.ur, i);
  });
  const used = new Set<number>();
  const stack = winUid == null ? [] : [winUid];
  while (stack.length) {
    const i = creator.get(stack.pop()!);
    if (i === undefined || used.has(i)) continue;
    used.add(i);
    const e = log[i] as Exclude<LogEntry, { reset: true }>;
    stack.push(e.ua, e.ub);
  }
  return used;
}

/** Share grid: 🟨 used in the final brew, 🟪 detour, one row per reset. */
export function shareGrid(run: Run): string[] {
  const used = contributingMerges(run.log, run.winUid);
  const rows: string[] = [];
  let row = "";
  run.log.forEach((e, i) => {
    if ("reset" in e) {
      rows.push(row ? `${row} 🔄` : "🔄");
      row = "";
    } else {
      row += used.has(i) ? "🟨" : "🟪";
    }
  });
  if (row) rows.push(row);
  return rows;
}

export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
