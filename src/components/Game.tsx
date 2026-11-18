"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { indexUrl, puzzleUrl } from "@/lib/config";
import { formatDate, todayPuzzleNumber } from "@/lib/date";
import { freshBoard, hasMoves, newRun, pairKey, reactionTable, stars } from "@/lib/game";
import { load, save } from "@/lib/storage";
import { alchemyTitle } from "@/lib/titles";
import type { PuzzleBundle, PuzzleIndex, Run, Stats } from "@/lib/types";
import ElementIcon from "./ElementIcon";
import Modal from "./Modal";
import WinPanel from "./WinPanel";
import StatsPanel from "./StatsPanel";
import ArchivePanel from "./ArchivePanel";
import HelpPanel from "./HelpPanel";
import TransmutationCircle from "./TransmutationCircle";

type Panel = null | "win" | "stats" | "archive" | "help";
interface Selection { n: number; practice: boolean }
interface Burst { id: number; x: number; y: number; big: boolean }
interface Toast { id: number; text: string; kind: "ok" | "new" | "fizzle" | "info" | "win" }
interface SavedRun { v: 2; sig: string; run: Run }
interface Drag { uid: number; x0: number; y0: number; moved: boolean; el: HTMLElement }

const EMPTY_STATS: Stats = { wins: 0, streak: 0, maxStreak: 0, lastWon: null, dist: {}, results: {} };

const FIZZLES = [
  (a: string, b: string) => `${a} and ${b} refuse to mingle.`,
  (a: string, b: string) => `${a} + ${b}… a sad little puff of smoke.`,
  (a: string, b: string) => `Nothing stirs between ${a} and ${b}.`,
  (a: string, b: string) => `${a} gives ${b} the cold shoulder.`,
  (a: string, b: string) => `The cauldron shrugs at ${a} and ${b}.`,
];

const runKey = (s: Selection) => (s.practice ? `practice:${s.n}` : `run:${s.n}`);
const clamp01 = (v: number) => Math.min(0.98, Math.max(0.02, v));

export default function Game() {
  const [index, setIndex] = useState<PuzzleIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [todayN, setTodayN] = useState(0);
  const [sel, setSel] = useState<Selection | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleBundle | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [flash, setFlash] = useState(0);

  const benchRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tokenEls = useRef(new Map<number, HTMLElement>());
  const drag = useRef<Drag | null>(null);
  const seq = useRef(0);
  const winTimer = useRef<number | undefined>(undefined);

  const boardSize = () => {
    const r = boardRef.current?.getBoundingClientRect();
    return r && r.width > 80 && r.height > 80 ? ([r.width, r.height] as const) : ([800, 520] as const);
  };

  // ---- boot: index, today's number, URL selection, stats -------------------
  useEffect(() => {
    setStats(load("stats", EMPTY_STATS));
    fetch(indexUrl())
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((idx: PuzzleIndex) => {
        const params = new URLSearchParams(window.location.search);
        let now = new Date();
        // dev only: ?date=2027-01-05 fakes today
        const fake = process.env.NODE_ENV !== "production" && params.get("date");
        if (fake) now = new Date(`${fake}T12:00:00`);
        const t = todayPuzzleNumber(idx.startDate, idx.count, now);
        const q = Number(params.get("n"));
        const n = q >= 1 && q <= t ? q : t;
        setIndex(idx);
        setTodayN(t);
        setSel({ n, practice: n !== t || params.has("practice") });
        if (!load("seenHelp", false)) {
          setPanel("help");
          save("seenHelp", true);
        }
      })
      .catch(() => setLoadError(true));
  }, []);

  // ---- load the selected puzzle + any saved run ------------------------------
  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    setSelected(null);
    setHover(null);
    setBursts([]);
    window.clearTimeout(winTimer.current);
    fetch(puzzleUrl(sel.n))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((p: PuzzleBundle) => {
        if (cancelled) return;
        const saved = load<SavedRun | null>(runKey(sel), null);
        const ok = saved && saved.v === 2 && saved.sig === p.tokens.join(",");
        const r = ok ? saved.run : newRun(p, ...boardSize());
        setPuzzle(p);
        setRun(r);
        setPanel((cur) => (r.won && cur !== "help" ? "win" : cur === "win" ? null : cur));
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [sel]);

  // ---- persist the run --------------------------------------------------------
  useEffect(() => {
    if (sel && puzzle && run && puzzle.n === sel.n)
      save(runKey(sel), { v: 2, sig: puzzle.tokens.join(","), run } satisfies SavedRun);
  }, [sel, puzzle, run]);

  // ---- keep the URL in sync ----
  useEffect(() => {
    if (!sel || !todayN) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("n");
    url.searchParams.delete("practice");
    if (sel.n !== todayN) url.searchParams.set("n", String(sel.n));
    else if (sel.practice) url.searchParams.set("practice", "1");
    window.history.replaceState(null, "", url);
  }, [sel, todayN]);

  const table = useMemo(() => (puzzle ? reactionTable(puzzle) : new Map<number, number>()), [puzzle]);
  const name = useCallback((id: number) => puzzle?.elements[id]?.[0] ?? "???", [puzzle]);
  const icon = useCallback((id: number) => puzzle?.elements[id]?.[1] ?? "", [puzzle]);

  const showToast = useCallback((text: string, kind: Toast["kind"], ms = 2200) => {
    const id = ++seq.current;
    setToast({ id, text, kind });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), ms);
  }, []);

  const isDaily = !!sel && !sel.practice && sel.n === todayN;
  const stuck = !!run && !run.won && !hasMoves(run.board, table);
  const lastLog = run?.log[run.log.length - 1];
  const canReset = !!run && !run.won && !!lastLog && !("reset" in lastLog);
  const freshDeal = !lastLog || "reset" in lastLog;

  // ---- geometry helpers --------------------------------------------------------
  function glyphRect(uid: number) {
    const el = tokenEls.current.get(uid);
    if (!el) return null;
    return ((el.querySelector(".glyph") as HTMLElement | null) ?? el).getBoundingClientRect();
  }

  function addBurst(uid: number, big: boolean) {
    const r = glyphRect(uid);
    const bench = benchRef.current?.getBoundingClientRect();
    if (!r || !bench) return;
    const id = ++seq.current;
    const b = { id, x: r.left + r.width / 2 - bench.left, y: r.top + r.height / 2 - bench.top, big };
    setBursts((bs) => [...bs, b]);
    window.setTimeout(() => setBursts((bs) => bs.filter((x) => x.id !== id)), big ? 1600 : 900);
  }

  function shake(uids: number[]) {
    setShaking([]);
    window.setTimeout(() => setShaking(uids), 10);
    window.setTimeout(() => setShaking((s) => (s === uids ? [] : s)), 520);
  }

  // ---- actions ---------------------------------------------------------------
  function recordWin(p: PuzzleBundle, r: Run) {
    const title = alchemyTitle(r.merges, p.par, p.complexity);
    const s: Stats = JSON.parse(JSON.stringify(stats));
    const key = String(p.n);
    const prev = s.results[key];
    if (isDaily && !prev?.daily) {
      s.wins += 1;
      s.streak = s.lastWon === p.n - 1 ? s.streak + 1 : 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      s.lastWon = p.n;
      const over = r.merges - p.par;
      const bucket = over >= 4 ? "4+" : String(over);
      s.dist[bucket] = (s.dist[bucket] ?? 0) + 1;
    }
    if (!prev || r.merges < prev.merges) {
      s.results[key] = { merges: r.merges, par: p.par, title: title.name, daily: isDaily || !!prev?.daily };
    } else if (isDaily && !prev.daily) {
      s.results[key] = { ...prev, daily: true };
    }
    setStats(s);
    save("stats", s);
  }

  /** Returns true if the pair reacted. */
  function attemptMerge(u1: number, u2: number): boolean {
    if (!puzzle || !run || run.won || u1 === u2) return false;
    const t1 = run.board.find((t) => t.uid === u1);
    const t2 = run.board.find((t) => t.uid === u2);
    if (!t1 || !t2) return false;
    const k = pairKey(t1.id, t2.id);
    const r = table.get(k);
    if (r === undefined) {
      setRun({ ...run, fizzles: run.fizzles + 1 });
      shake([u1, u2]);
      const line = FIZZLES[(t1.id * 7 + t2.id * 13 + run.fizzles) % FIZZLES.length];
      showToast(line(name(t1.id), name(t2.id)), "fizzle");
      return false;
    }
    const ur = run.nextUid;
    const won = r === puzzle.target;
    const isNew = !run.discovered.includes(k);
    const next: Run = {
      ...run,
      // result appears where they met
      board: run.board.flatMap((t) => (t.uid === u1 ? [] : t.uid === u2 ? [{ uid: ur, id: r, x: t.x, y: t.y }] : [t])),
      merges: run.merges + 1,
      log: [...run.log, { a: t1.id, b: t2.id, r, ua: u1, ub: u2, ur }],
      discovered: isNew ? [...run.discovered, k] : run.discovered,
      won,
      winUid: won ? ur : null,
      nextUid: ur + 1,
    };
    addBurst(u2, won);
    setFlash((f) => f + 1);
    setRun(next);
    if (won) {
      showToast(`✨ You brewed ${name(r)}!`, "win", 2600);
      recordWin(puzzle, next);
      winTimer.current = window.setTimeout(() => setPanel("win"), 1300);
    } else {
      showToast(`${name(t1.id)} + ${name(t2.id)} = ${name(r)}${isNew ? "  ✦ new!" : ""}`, isNew ? "new" : "ok");
    }
    return true;
  }

  function moveToken(uid: number, x: number, y: number) {
    if (!run) return;
    setRun({ ...run, board: run.board.map((t) => (t.uid === uid ? { ...t, x: clamp01(x), y: clamp01(y) } : t)) });
  }

  function resetBoard() {
    if (!puzzle || !run || !canReset) return;
    setRun({
      ...run,
      board: freshBoard(puzzle.tokens, run.nextUid, ...boardSize()),
      nextUid: run.nextUid + puzzle.tokens.length,
      log: [...run.log, { reset: true }],
    });
    setSelected(null);
    showToast("The board is restocked. Your merge count carries on.", "info");
  }

  function playAgain() {
    if (!puzzle || !sel) return;
    const s = { n: sel.n, practice: true };
    save(runKey(s), null); // always start a clean practice run
    setPanel(null);
    if (!sel.practice) setSel(s);
    else setRun(newRun(puzzle, ...boardSize()));
  }

  function pick(n: number) {
    setPanel(null);
    if (sel && n === sel.n && sel.practice === (n !== todayN)) return;
    setSel({ n, practice: n !== todayN });
  }

  function tap(uid: number) {
    if (run?.won) return;
    if (selected == null) setSelected(uid);
    else if (selected === uid) setSelected(null);
    else {
      attemptMerge(selected, uid);
      setSelected(null);
    }
  }

  // ---- pointer dragging --------------------------------------------------------
  function findDropTarget(x: number, y: number, self: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    tokenEls.current.forEach((_, uid) => {
      if (uid === self) return;
      const r = glyphRect(uid);
      if (!r) return;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < r.width * 0.75 && d < bestD) {
        best = uid;
        bestD = d;
      }
    });
    return best;
  }

  function onPointerDown(e: RPointerEvent<HTMLDivElement>, uid: number) {
    if (run?.won || e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { uid, x0: e.clientX, y0: e.clientY, moved: false, el: e.currentTarget };
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      setDragging(d.uid);
      setSelected(null);
    }
    d.el.style.transform = `translate(${dx}px, ${dy}px)`;
    const target = findDropTarget(e.clientX, e.clientY, d.uid);
    setHover((h) => (h === target ? h : target));
  }

  function endDrag(e: RPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(null);
    setHover(null);
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const glide = () =>
      d.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: 260,
        easing: "cubic-bezier(.2,.9,.3,1.2)",
      });
    d.el.style.transform = "";
    if (!d.moved) {
      if (!cancelled) tap(d.uid);
      return;
    }
    if (cancelled) {
      glide();
      return;
    }
    const target = findDropTarget(e.clientX, e.clientY, d.uid);
    if (target != null) {
      if (!attemptMerge(d.uid, target)) glide(); // fizzled: float back home
      return;
    }
    // dropped on empty wood: move it
    const board = boardRef.current?.getBoundingClientRect();
    const tok = run?.board.find((t) => t.uid === d.uid);
    if (!board || !tok) return;
    moveToken(d.uid, tok.x + dx / board.width, tok.y + dy / board.height);
  }

  // ---- render --------------------------------------------------------------------
  const dateLabel = puzzle ? formatDate(puzzle.date) : "";
  const modeLabel = sel?.practice ? "PRACTICE" : "DAILY";
  const winTitle = puzzle && run?.won ? alchemyTitle(run.merges, puzzle.par, puzzle.complexity) : null;

  return (
    <main className="app">
      <header className="hud">
        <div className="hud-top">
          <button className="icon-btn" onClick={() => setPanel("help")} aria-label="How to play" title="How to play">
            ?
          </button>
          <div className="title-block">
            <h1 className="title">
              <span className="title-flourish" aria-hidden>✦</span>
              Alchemdle
              <span className="title-flourish" aria-hidden>✦</span>
            </h1>
            <p className="subtitle">
              {sel && puzzle ? (
                <>
                  {modeLabel} #{puzzle.n} <span className="dot">•</span> {dateLabel}
                </>
              ) : (
                <>&nbsp;</>
              )}
            </p>
          </div>
          <div className="hud-icons">
            <button className="icon-btn" onClick={() => setPanel("archive")} aria-label="Archive" title="Archive & practice">
              <svg viewBox="0 0 24 24" aria-hidden><path d="M5 3h11l3 3v15H5z M8 8h8 M8 12h8 M8 16h5" /></svg>
            </button>
            <button className="icon-btn" onClick={() => setPanel("stats")} aria-label="Statistics" title="Statistics">
              <svg viewBox="0 0 24 24" aria-hidden><path d="M5 20V11 M12 20V5 M19 20v-6 M3 20h18" /></svg>
            </button>
          </div>
        </div>

        <div className="hud-row">
          <section className="brew" aria-live="polite">
            <div className="brew-ribbon">{isDaily ? "Today’s Brew" : "Practice Brew"}</div>
            <div className="brew-card">
              {puzzle ? (
                <>
                  <div className={`orb orb-target${run?.won ? " brewed" : ""}`}>
                    <ElementIcon icon={icon(puzzle.target)} />
                  </div>
                  <div className="brew-text">
                    <div className="brew-name">{name(puzzle.target)}</div>
                    <div className="brew-meta">
                      <span className="stars" aria-label={`Difficulty ${puzzle.difficulty} of 5`}>
                        {stars(puzzle.difficulty)}
                      </span>
                      <span className="dot">•</span>
                      <span title="Ingredients you start with">{puzzle.tokens.length} ingredients</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="brew-loading">
                  {loadError ? "The library is locked. Couldn’t load today’s brew." : "Consulting the stars…"}
                </div>
              )}
            </div>
          </section>

          <div className="plaques">
            <button
              className={`plaque plaque-btn${stuck ? " pulse" : ""}`}
              onClick={resetBoard}
              disabled={!canReset}
              title="Respawn the starting tokens (merges are kept)"
            >
              <span className="plaque-label">Reset</span>
              <span className="plaque-glyph" aria-hidden>↺</span>
            </button>
            <div className="plaque">
              <span className="plaque-label">Merges</span>
              <span className={`plaque-value${run && puzzle && run.merges > puzzle.par ? " over" : ""}`}>
                {run?.merges ?? "–"}
              </span>
            </div>
            <div className="plaque" title="Best: the fewest merges this brew can be made in">
              <span className="plaque-label">Best</span>
              <span className="plaque-value">{puzzle?.par ?? "–"}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="bench-frame">
        <div className={`bench${run?.won ? " won" : ""}`} ref={benchRef}>
          <div className="bench-glow" aria-hidden />
          <TransmutationCircle flash={flash} />

          <div className={`board${run?.won ? " won" : ""}`} ref={boardRef}>
            {run?.board.map((t, i) => {
              const cls = [
                "token",
                selected === t.uid ? "selected" : "",
                hover === t.uid ? "hover" : "",
                dragging === t.uid ? "dragging" : "",
                run.winUid === t.uid ? "winner" : "",
              ].join(" ");
              const style = {
                "--x": t.x,
                "--y": t.y,
                animationDelay: freshDeal ? `${i * 45}ms` : undefined,
              } as CSSProperties;
              return (
                <div
                  key={t.uid}
                  className={cls}
                  ref={(el) => {
                    if (el) tokenEls.current.set(t.uid, el);
                    else tokenEls.current.delete(t.uid);
                  }}
                  style={style}
                  role="button"
                  tabIndex={run.won ? -1 : 0}
                  aria-pressed={selected === t.uid}
                  aria-label={name(t.id)}
                  onPointerDown={(e) => onPointerDown(e, t.uid)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => endDrag(e, false)}
                  onPointerCancel={(e) => endDrag(e, true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tap(t.uid);
                    } else if (e.key === "Escape") setSelected(null);
                  }}
                >
                  <div className={`glyph${shaking.includes(t.uid) ? " shake" : ""}`}>
                    <ElementIcon icon={icon(t.id)} />
                  </div>
                  <div className="token-label">{name(t.id)}</div>
                </div>
              );
            })}
          </div>

          {bursts.map((b) => (
            <div key={b.id} className={`burst${b.big ? " big" : ""}`} style={{ left: b.x, top: b.y }} aria-hidden>
              <span className="burst-ring" />
              {Array.from({ length: b.big ? 18 : 10 }, (_, i) => (
                <span key={i} className="spark" style={{ ["--a" as string]: `${(360 / (b.big ? 18 : 10)) * i}deg` }} />
              ))}
            </div>
          ))}

          {stuck && (
            <div className="stuck" role="status">
              <p>The cauldron has gone quiet. Nothing left on the bench will react.</p>
              <button className="btn" onClick={resetBoard}>
                ↺ Reset the board
              </button>
            </div>
          )}

          {run?.won && panel !== "win" && (
            <div className="won-bar">
              <button className="btn btn-primary" onClick={() => setPanel("win")}>
                {winTitle?.emoji} See your result
              </button>
            </div>
          )}

          <div className="bench-foot">
            <span>
              Discoveries <b>{run?.discovered.length ?? 0}</b> / {puzzle?.possibleReactions ?? "–"}
            </span>
            {!run?.won && <span className="hint">Drag an ingredient onto another, or tap two.</span>}
          </div>
        </div>
      </section>

      <footer className="credits">
        Emoji by <a href="https://openmoji.org" target="_blank" rel="noreferrer">OpenMoji</a> (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>) · Icons
        by Lorc, Delapouite &amp; contributors at{" "}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>, recoloured) ·{" "}
        <button className="link-btn" onClick={() => setPanel("help")}>
          Full credits
        </button>
      </footer>

      {toast && (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      {panel === "win" && puzzle && run?.won && sel && (
        <Modal onClose={() => setPanel(null)} label="Brew complete">
          <WinPanel
            puzzle={puzzle}
            run={run}
            practice={sel.practice}
            name={name}
            icon={icon}
            onPlayAgain={playAgain}
            onArchive={() => setPanel("archive")}
            onToast={(t) => showToast(t, "info")}
          />
        </Modal>
      )}
      {panel === "stats" && (
        <Modal onClose={() => setPanel(null)} label="Statistics">
          <StatsPanel stats={stats} todayN={todayN} />
        </Modal>
      )}
      {panel === "archive" && index && (
        <Modal onClose={() => setPanel(null)} label="Archive">
          <ArchivePanel index={index} todayN={todayN} current={sel} stats={stats} onPick={pick} />
        </Modal>
      )}
      {panel === "help" && (
        <Modal onClose={() => setPanel(null)} label="How to play">
          <HelpPanel onClose={() => setPanel(null)} />
        </Modal>
      )}
    </main>
  );
}
