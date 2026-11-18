export type Mode = "classic" | "brainrot";

type Two = (a: string, b: string) => string;

export interface ModeCopy {
  label: string;
  icon: string;
  /** folder under public/ with this mode's bundles */
  dir: string;
  /** localStorage key prefix */
  store: string;
  shareTag: string;
  daily: string;
  ribbon: string;
  ribbonPractice: string;
  brewed: string;
  winToast: (x: string) => string;
  newTag: string;
  fizzles: Two[];
  stuck: string;
  stuckBtn: string;
  hint: string;
  restock: string;
  loading: string;
  loadError: string;
  verdicts: Record<1 | 2 | 3, string>;
  recipe: string;
  next: string;
  difficulty: (n: number) => string;
}

export const MODES: Record<Mode, ModeCopy> = {
  classic: {
    label: "Classic",
    icon: "⚗️",
    dir: "puzzles",
    store: "",
    shareTag: "🧪 Alchemdle",
    daily: "DAILY",
    ribbon: "Today’s Brew",
    ribbonPractice: "Practice Brew",
    brewed: "You brewed",
    winToast: (x) => `✨ You brewed ${x}!`,
    newTag: "  ✦ new!",
    fizzles: [
      (a, b) => `${a} and ${b} refuse to mingle.`,
      (a, b) => `${a} + ${b}… a sad little puff of smoke.`,
      (a, b) => `Nothing stirs between ${a} and ${b}.`,
      (a, b) => `${a} gives ${b} the cold shoulder.`,
      (a, b) => `The cauldron shrugs at ${a} and ${b}.`,
    ],
    stuck: "The cauldron has gone quiet. Nothing left on the bench will react.",
    stuckBtn: "↺ Reset the board",
    hint: "Drag an ingredient onto another, or tap two.",
    restock: "The board is restocked. Your merge count carries on.",
    loading: "Consulting the stars…",
    loadError: "The library is locked. Couldn’t load today’s brew.",
    verdicts: { 3: "Perfect brew!", 2: "So close!", 1: "Brewed it!" },
    recipe: "The Master’s Recipe",
    next: "Next brew in",
    difficulty: (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n)),
  },
  brainrot: {
    label: "Brainrot",
    icon: "🧠",
    dir: "brainrot",
    store: "br:",
    shareTag: "🧠 Alchemdle Brainrot",
    daily: "BRAINROT",
    ribbon: "Today’s Rot",
    ribbonPractice: "Practice Rot",
    brewed: "You cooked",
    winToast: (x) => `🔥 you cooked ${x}. W`,
    newTag: "  🆕 W",
    fizzles: [
      (a, b) => `${a} + ${b}? nah 💀`,
      (a, b) => `${a} left ${b} on read.`,
      (a, b) => `${a} and ${b} have zero rizz together.`,
      (a, b) => `-100 aura. ${a} + ${b} ain’t it.`,
      (a, b) => `bro really tried ${a} + ${b} 😭`,
    ],
    stuck: "it’s so over 💀 nothing on the board reacts anymore.",
    stuckBtn: "↺ run it back",
    hint: "drag one onto another, or tap two. no cap.",
    restock: "fresh board. merge count stays tho 👀",
    loading: "loading the brainrot… 🧠",
    loadError: "the server took an L. couldn’t load today’s puzzle.",
    verdicts: { 3: "absolute cinema 🗿", 2: "so close it hurts 😭", 1: "you cooked (eventually)" },
    recipe: "The Sigma Route 🗿",
    next: "Next rot in",
    difficulty: (n) => "💀".repeat(n),
  },
};

export const otherMode = (m: Mode): Mode => (m === "classic" ? "brainrot" : "classic");
