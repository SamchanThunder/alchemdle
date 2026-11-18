// bump the version to wipe everyone's saved stats and runs
const PREFIX = "alchemdle:v2:";
const OLD = ["alchemdle:v1:"];

let cleaned = false;
function dropOld() {
  if (cleaned) return;
  cleaned = true;
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k && OLD.some((p) => k.startsWith(p))) ls.removeItem(k);
    }
  } catch {
    /* storage blocked */
  }
}

export function load<T>(key: string, fallback: T): T {
  dropOld();
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: play on without persistence */
  }
}
