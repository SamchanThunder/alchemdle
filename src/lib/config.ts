export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const iconUrl = (icon: string) => `${BASE}/icons/${icon}.svg`;
export const puzzleUrl = (n: number) => `${BASE}/puzzles/${n}.json`;
export const indexUrl = () => `${BASE}/puzzles/index.json`;
