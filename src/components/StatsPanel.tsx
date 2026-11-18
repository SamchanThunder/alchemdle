import type { Stats } from "@/lib/types";

const BUCKETS = ["0", "1", "2", "3", "4+"];

export default function StatsPanel({ stats, todayN }: { stats: Stats; todayN: number }) {
  const alive = stats.lastWon != null && stats.lastWon >= todayN - 1;
  const streak = alive ? stats.streak : 0;
  const parRate = stats.wins ? Math.round(((stats.dist["0"] ?? 0) / stats.wins) * 100) : 0;
  const max = Math.max(1, ...BUCKETS.map((b) => stats.dist[b] ?? 0));
  const practiced = Object.values(stats.results).filter((r) => !r.daily).length;
  return (
    <div className="stats">
      <h2 className="panel-title">Alchemist’s Ledger</h2>
      <div className="stat-row">
        <div className="stat">
          <b>{stats.wins}</b>
          <span>Daily brews</span>
        </div>
        <div className="stat">
          <b>{streak}</b>
          <span>Streak</span>
        </div>
        <div className="stat">
          <b>{stats.maxStreak}</b>
          <span>Best streak</span>
        </div>
        <div className="stat">
          <b>{parRate}%</b>
          <span>At par</span>
        </div>
      </div>
      <h3 className="panel-sub">Merges over par</h3>
      <div className="dist">
        {BUCKETS.map((b) => {
          const v = stats.dist[b] ?? 0;
          return (
            <div className="dist-row" key={b}>
              <span className="dist-label">{b === "0" ? "Par" : `+${b}`}</span>
              <span className="dist-track">
                <span className={`dist-bar${v ? "" : " empty"}`} style={{ width: `${Math.max(9, (v / max) * 100)}%` }}>
                  {v}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {practiced > 0 && (
        <p className="muted center">
          Plus {practiced} practice brew{practiced === 1 ? "" : "s"} from the archive.
        </p>
      )}
    </div>
  );
}
