"use client";

import { useState } from "react";
import { BASE } from "@/lib/config";
import { pairKey, shareGrid } from "@/lib/game";
import { alchemyTitle } from "@/lib/titles";
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
  const [revealed, setRevealed] = useState(run.merges === puzzle.par);
  const title = alchemyTitle(run.merges, puzzle.par, puzzle.complexity);
  const over = run.merges - puzzle.par;
  const grid = shareGrid(run);
  const found = new Set(run.discovered);

  async function share() {
    const head = `Alchemdle #${puzzle.n}${practice ? " (practice)" : ""} ⚗️ ${run.merges}/${puzzle.par}`;
    const url = `${window.location.origin}${BASE}/`;
    const text = [head, `${title.emoji} ${title.name}`, ...grid, url].join("\n");
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast("Result copied to your clipboard.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onToast("Couldn’t copy. Select the grid above instead.");
    }
  }

  return (
    <div className="win">
      <div className="win-hero">
        <div className="orb orb-hero brewed">
          <ElementIcon icon={icon(puzzle.target)} />
        </div>
        <p className="win-kicker">You brewed</p>
        <h2 className="win-target">{name(puzzle.target)}</h2>
      </div>

      <div className="win-title">
        <span className="win-title-emoji" aria-hidden>
          {title.emoji}
        </span>
        <div>
          <div className="win-title-name">{title.name}</div>
          <div className="win-title-blurb">{title.blurb}</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <b>{run.merges}</b>
          <span>Merges</span>
        </div>
        <div className="stat">
          <b>{puzzle.par}</b>
          <span>Par</span>
        </div>
        <div className="stat">
          <b>{over === 0 ? "±0" : `+${over}`}</b>
          <span>Over par</span>
        </div>
        <div className="stat">
          <b>
            {run.discovered.length}
            <small>/{puzzle.possibleReactions}</small>
          </b>
          <span>Discoveries</span>
        </div>
      </div>

      <div className="share-box">
        <pre className="share-grid" aria-label="Share grid">
          {grid.join("\n")}
        </pre>
        <p className="share-legend">🟨 fed the brew · 🟪 detour · 🔄 reset</p>
        <button className="btn btn-primary" onClick={share}>
          Share result
        </button>
      </div>

      <div className="path">
        <h3 className="panel-sub">The Master’s Recipe</h3>
        {revealed ? (
          <>
            <ol className="path-list">
              {puzzle.optimalPath.map(([a, b, r], i) => (
                <li key={i} className={found.has(pairKey(a, b)) ? "made" : ""}>
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
                </li>
              ))}
            </ol>
            <p className="muted small center">
              {puzzle.optimalRoutes === 1
                ? "This is the only route at par."
                : `One of ${puzzle.optimalRoutes} routes at par.`}{" "}
              Steps you also made are marked ✓.
            </p>
          </>
        ) : (
          <button className="btn" onClick={() => setRevealed(true)}>
            Reveal the par route
          </button>
        )}
      </div>

      <div className="win-foot">
        {!practice && (
          <p className="next-brew">
            Next brew in <Countdown />
          </p>
        )}
        <div className="panel-actions">
          <button className="btn" onClick={onPlayAgain}>
            {practice ? "↺ Brew again" : "↺ Practice this brew"}
          </button>
          <button className="btn" onClick={onArchive}>
            📜 Archive
          </button>
        </div>
      </div>
    </div>
  );
}
