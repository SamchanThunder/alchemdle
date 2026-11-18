/** [a, b, result] with a <= b */
export type Reaction = [number, number, number];

/** public/puzzles/<n>.json (built by scripts/build_web_data.mjs) */
export interface PuzzleBundle {
  n: number;
  date: string;
  weekday: string;
  target: number;
  par: number;
  difficulty: number;
  complexity: number;
  tokens: number[];
  distractors: number[];
  optimalPath: Reaction[];
  optimalRoutes: number;
  routesByMerges: Record<string, number>;
  possibleReactions: number;
  /** every reaction reachable on this board */
  reactions: Reaction[];
  /** id -> [name, icon] for every element that can appear */
  elements: Record<string, [string, string]>;
}

export interface IndexEntry {
  n: number;
  date: string;
  par: number;
  difficulty: number;
  target: string;
  icon: string;
}

export interface PuzzleIndex {
  startDate: string;
  count: number;
  puzzles: IndexEntry[];
}

export interface Tok {
  uid: number;
  id: number;
  /** position on the board as fractions (0–1) of its width/height */
  x: number;
  y: number;
}

export type LogEntry =
  | { a: number; b: number; r: number; ua: number; ub: number; ur: number }
  | { reset: true };

export interface Run {
  board: Tok[];
  merges: number;
  fizzles: number;
  log: LogEntry[];
  /** pair keys of reactions found so far */
  discovered: number[];
  won: boolean;
  winUid: number | null;
  nextUid: number;
}

export interface ResultRecord {
  merges: number;
  par: number;
  title: string;
  daily: boolean;
}

export interface Stats {
  wins: number;
  streak: number;
  maxStreak: number;
  lastWon: number | null;
  /** merges over par -> count ("0".."3", "4+") for daily wins */
  dist: Record<string, number>;
  /** best result per puzzle number (daily or practice) */
  results: Record<string, ResultRecord>;
}
