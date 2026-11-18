import { formatDate } from "@/lib/date";
import { stars } from "@/lib/game";
import type { PuzzleIndex, Stats } from "@/lib/types";
import ElementIcon from "./ElementIcon";

interface Props {
  index: PuzzleIndex;
  todayN: number;
  current: { n: number; practice: boolean } | null;
  stats: Stats;
  onPick: (n: number) => void;
}

export default function ArchivePanel({ index, todayN, current, stats, onPick }: Props) {
  const past = index.puzzles.slice(0, todayN).reverse();
  const others = past.filter((p) => p.n !== todayN);
  const random = () => onPick(others[Math.floor(Math.random() * others.length)].n);
  return (
    <div className="archive">
      <h2 className="panel-title">The Archive</h2>
      <p className="lede">Past brews are yours to practice. They won’t touch your daily streak.</p>
      <div className="panel-actions">
        <button className="btn" onClick={random} disabled={!others.length}>
          🎲 Random practice brew
        </button>
      </div>
      {!others.length && <p className="muted center">The archive grows by one brew a day. Check back tomorrow!</p>}
      <ul className="archive-list">
        {past.map((p) => {
          const res = stats.results[String(p.n)];
          const isCurrent = current?.n === p.n;
          return (
            <li key={p.n}>
              <button className={`archive-item${isCurrent ? " current" : ""}`} onClick={() => onPick(p.n)}>
                <span className="archive-num">#{p.n}</span>
                <span className="orb orb-mini">
                  <ElementIcon icon={p.icon} />
                </span>
                <span className="archive-main">
                  <span className="archive-name">{p.target}</span>
                  <span className="archive-date">
                    {p.n === todayN ? "Today" : formatDate(p.date)} · best {p.par} ·{" "}
                    <span className="stars">{stars(p.difficulty)}</span>
                  </span>
                </span>
                <span className="archive-res" title={res?.title}>
                  {res ? `✓ ${res.merges}/${res.par}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
