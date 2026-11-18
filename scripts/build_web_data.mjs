#!/usr/bin/env node
// Writes one small JSON file per day to public/puzzles/ (classic) and
// public/brainrot/ (if data/brainrot_puzzles.json exists), plus an index each.
// Each file lists every reaction that can happen on that day's board.
// Usage: node scripts/build_web_data.mjs

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const K = 1 << 13; // > element count

function reachable(tokens, lookup) {
  const n = tokens.length;
  const full = (1 << n) - 1;
  const R = new Array(full + 1);
  const reactions = new Map(); // pairKey -> [a,b,r]
  for (let i = 0; i < n; i++) R[1 << i] = new Set([tokens[i]]);
  // Masks in order of popcount so sub-results are ready.
  const masks = [];
  for (let m = 1; m <= full; m++) masks.push(m);
  const pop = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  masks.sort((a, b) => pop(a) - pop(b));
  for (const S of masks) {
    if (pop(S) < 2) continue;
    const out = new Set();
    const low = S & -S;
    // A always contains the lowest bit, so each unordered split is seen once.
    for (let A = (S - 1) & S; A > 0; A = (A - 1) & S) {
      if (!(A & low)) continue;
      const B = S ^ A;
      if (!B) continue;
      for (const x of R[A]) for (const y of R[B]) {
        const r = lookup(x, y);
        if (r === undefined) continue;
        out.add(r);
        const a = Math.min(x, y), b = Math.max(x, y);
        reactions.set(a * K + b, [a, b, r]);
      }
    }
    R[S] = out;
  }
  return [...reactions.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

function build(src, dir, elementsFile, recipesFile) {
  const daily = read(src);
  const { elements } = read(elementsFile);
  const { recipes } = read(recipesFile);
  if (elements.length >= K) throw new Error("element ids exceed pair key space");
  const recipe = new Map();
  for (const [a, b, r] of recipes) recipe.set(a * K + b, r);
  const lookup = (x, y) => (x <= y ? recipe.get(x * K + y) : recipe.get(y * K + x));
  const outDir = join(root, "public", dir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const index = [];
  let mismatches = 0;
  for (const p of daily.puzzles) {
    const reactions = reachable(p.tokens, lookup);
    if (reactions.length !== p.possible_reactions) {
      mismatches++;
      console.warn(`#${p.number}: ${reactions.length} reactions vs possible_reactions=${p.possible_reactions}`);
    }
    const ids = new Set([p.target, ...p.tokens]);
    for (const [a, b, r] of reactions) { ids.add(a); ids.add(b); ids.add(r); }
    for (const [a, b, r] of p.optimal_path) { ids.add(a); ids.add(b); ids.add(r); }
    const els = {};
    for (const id of [...ids].sort((a, b) => a - b)) els[id] = [elements[id].name, elements[id].icon];

    const bundle = {
      n: p.number,
      date: p.date,
      weekday: p.weekday,
      target: p.target,
      par: p.par,
      difficulty: p.difficulty,
      complexity: p.complexity,
      tokens: p.tokens,
      distractors: p.distractors,
      optimalPath: p.optimal_path,
      optimalRoutes: p.optimal_routes,
      routesByMerges: p.routes_by_merges,
      possibleReactions: reactions.length,
      reactions,
      elements: els,
    };
    writeFileSync(join(outDir, `${p.number}.json`), JSON.stringify(bundle));
    index.push({
      n: p.number,
      date: p.date,
      par: p.par,
      difficulty: p.difficulty,
      target: elements[p.target].name,
      icon: elements[p.target].icon,
    });
  }
  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify({ startDate: daily.start_date, count: index.length, puzzles: index }),
  );
  console.log(`wrote ${index.length} puzzle bundles to public/${dir} (${mismatches} reaction-count mismatches)`);
  if (mismatches) process.exitCode = 1;
}

build("data/daily_puzzles.json", "puzzles", "data/elements.json", "data/recipes.json");
if (existsSync(join(root, "data/brainrot_puzzles.json")))
  build("data/brainrot_puzzles.json", "brainrot", "data/brainrot_elements.json", "data/brainrot_recipes.json");
else rmSync(join(root, "public", "brainrot"), { recursive: true, force: true });
