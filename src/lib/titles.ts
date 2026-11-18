export interface AlchemyTitle {
  name: string;
  emoji: string;
  blurb: string;
}

/** Title from merges over par. Harder boards are more forgiving. */
export function alchemyTitle(merges: number, par: number, complexity: number): AlchemyTitle {
  const over = Math.max(0, merges - par);
  if (over === 0) {
    if (complexity >= 0.8)
      return { name: "Philosopher's Stone", emoji: "💎", blurb: "A flawless brew on a fiendish board. Bards will sing of this." };
    if (complexity >= 0.5)
      return { name: "Grand Alchemist", emoji: "👑", blurb: "Matched the best on a tricky board. Nothing wasted." };
    return { name: "Master Alchemist", emoji: "🏆", blurb: "Straight to gold. Matched the best." };
  }
  const eff = over / (1 + 1.5 * complexity);
  if (eff <= 1) return { name: "Adept Alchemist", emoji: "⚗️", blurb: "Barely a drop spilled." };
  if (eff <= 2) return { name: "Journeyman Brewer", emoji: "🧪", blurb: "A little smoke, a lot of progress." };
  if (eff <= 3.5) return { name: "Hedge Witch", emoji: "🌿", blurb: "Unorthodox methods, undeniable results." };
  if (eff <= 5.5) return { name: "Apprentice", emoji: "📜", blurb: "The master raised an eyebrow, but it bubbled!" };
  if (eff <= 8) return { name: "Cauldron Scrubber", emoji: "🧽", blurb: "Every pot in the tower is dirty, but you got there." };
  return { name: "Singed Eyebrows", emoji: "🔥", blurb: "Smoke alarms were involved. Still counts!" };
}
