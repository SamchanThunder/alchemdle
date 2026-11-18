export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const iconUrl = (icon: string) => `${BASE}/icons/${icon}.svg`;
export const puzzleUrl = (dir: string, n: number) => `${BASE}/${dir}/${n}.json`;
export const indexUrl = (dir: string) => `${BASE}/${dir}/index.json`;
