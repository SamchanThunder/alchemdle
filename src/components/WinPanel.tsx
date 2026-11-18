"use client";

import { BASE } from "@/lib/config";
import { pairKey, shareGrid } from "@/lib/game";
import { rating, starText } from "@/lib/titles";
import type { PuzzleBundle, Run } from "@/lib/types";
import Countdown from "./Countdown";
import ElementIcon from "./ElementIcon";

interface Props {
  puzzle: PuzzleBundle;
  run: Run;
  practice: boolean;
  name: (id: number) => string;
  icon: (id: number) => string;
  onPlayAgain: () => void;
  onArchive: () => void;
  onToast: (text: string) => void;
}

export default function WinPanel({ puzzle, run, practice, name, icon, onPlayAgain, onArchive, onToast }: Props) {
  const rate = rating(run.merges, puzzle.par);
  const over = run.merges - puzzle.par;
  const { rows, resets } = shareGrid(run);
  const found = new Set(run.discovered);
  const target = name(puzzle.target);

  async function share() {
    const line = [`${starText(rate.stars)} ${run.merges}/${puzzle.par} merges`];
    if (resets) line.push(`🔄 ${resets}`);
    const text = [
      `🧪 Alchemdle #${puzzle.n}${practice ? " (practice)" : ""} — ${target.toUpperCase()}`,
      line.join(" • "),
      ...rows,
      `${window.location.origin}${BASE}/`,
    ].join("\n");
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast("Result copied to your clipboard.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onToast("Couldn’t copy your result.");
    }
  }

  return (
    <div className="win">
      <div className="win-brewed">
        <span className="win-brewed-icon">
          <ElementIcon icon={icon(puzzle.target)} />
        </span>
        <span className="win-brewed-label">You brewed</span>
        <span className="win-brewed-name">{target}</span>
      </div>

      <div className="win-hero" aria-label={`${rate.stars} of 3 stars`}>
        <div className="win-stars">
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= rate.stars ? "" : "off"}>
              ★
            </i>
          ))}
        </div>
        <div className="win-score">
          <b>{run.merges}</b>
          <s>/ {puzzle.par}</s>
        </div>
        <div className="win-score-label">
          merges · goal {puzzle.par}
          {over > 0 && (
            <>
              {" "}
              · <em>+{over} over</em>
            </>
          )}
        </div>
        <div className={`win-verdict${rate.good ? " good" : ""}`}>{rate.verdict}</div>
      </div>

      <div className="win-stats">
        <span>
          <b>
            {run.discovered.length}/{puzzle.possibleReactions}
          </b>{" "}
          discoveries
        </span>
        <span>
          <b>{resets}</b> reset{resets === 1 ? "" : "s"}
        </span>
      </div>

      <div className="win-share">
        <div className="win-grid" aria-label="Share grid">
          <div className="win-grid-rows">
            {rows.map((row, r) => (
              <div key={r} className="win-grid-row">
                {Array.from(row).map((c, i) => (
                  <span key={i} className={`sq ${c === "🟨" ? "fed" : "detour"}`} />
                ))}
              </div>
            ))}
          </div>
          {resets > 0 && <span className="win-resets">🔄 ×{resets}</span>}
        </div>
        <button className="btn btn-primary" onClick={share}>
          Share result
        </button>
      </div>

      <div className="win-recipe">
        <h3>The Master’s Recipe</h3>
        {puzzle.optimalPath.map(([a, b, r], i) => {
          const made = found.has(pairKey(a, b));
          return (
            <div key={i} className="win-step">
              <span className="chip">
                <ElementIcon icon={icon(a)} />
                {name(a)}
              </span>
              <span className="op">+</span>
              <span className="chip">
                <ElementIcon icon={icon(b)} />
                {name(b)}
              </span>
              <span className="op">→</span>
              <span className="chip chip-result">
                <ElementIcon icon={icon(r)} />
                {name(r)}
              </span>
              <span className={made ? "step-ok" : "step-no"} title={made ? "You made this too" : undefined}>
                {made ? "✓" : "–"}
              </span>
            </div>
          );
        })}
      </div>

      <div className={`win-foot${practice ? " practice" : ""}`}>
        {!practice && (
          <div className="win-next">
            <small>Next brew in</small>
            <Countdown />
          </div>
        )}
        <div className="win-btns">
          <button className="btn" onClick={onPlayAgain}>
            {practice ? "↺ Brew again" : "↺ Practice"}
          </button>
          <button className="btn" onClick={onArchive}>
            📜 Archive
          </button>
        </div>
      </div>
    </div>
  );
}
