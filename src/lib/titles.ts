export interface Rating {
  stars: 1 | 2 | 3;
  verdict: string;
  good: boolean;
}

/** 3 stars at the goal, 2 when 1-2 over, 1 for finishing. */
export function rating(merges: number, par: number): Rating {
  const over = merges - par;
  if (over <= 0) return { stars: 3, verdict: "Perfect brew!", good: true };
  if (over <= 2) return { stars: 2, verdict: "So close!", good: false };
  return { stars: 1, verdict: "Brewed it!", good: false };
}

export const starText = (n: number) => "⭐".repeat(n);
