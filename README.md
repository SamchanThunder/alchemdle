# Alchemdle

A daily alchemy puzzle. Every day you get a target element (say, Goldfish) and a handful of starting ingredients. Drag one onto another to combine them, keep going until you make the target, and try to do it in as few merges as possible. Every puzzle has a par, the minimum number of merges it can be solved in, so it plays a bit like golf crossed with Wordle.

It's a static Next.js site. All the heavy lifting (building the recipe graph, generating puzzles, proving par) happens ahead of time in a Python pipeline. The client just fetches a small JSON file for the day and plays.

## How it plays

- One puzzle per day, picked from your local date. 366 are generated, starting 2026-11-17.
- Each ingredient is a single copy. Merging two uses up both and puts the result where they met.
- A pair that doesn't react just fizzles. That's free and doesn't count.
- Some ingredients are red herrings. Par is 4 to 7 depending on the weekday (Mon/Tue 4, Wed/Thu 5, Fri/Sun 6, Sat 7).
- Reset brings back the starting ingredients but keeps your merge count. If nothing left on the board can react, the game tells you so and points you at Reset.
- When you win you get a title based on how far over par you went (adjusted for how hard the board was), the optimal route, and a share grid. Stats and streaks live in localStorage, and past days can be replayed in practice mode without touching your streak.

## Stack

- **Data pipeline:** Python 3, standard library only
- **Frontend:** Next.js 16 (App Router, `output: "export"`), React 19, TypeScript
- **Styling:** plain CSS, no UI library. The wood grain is an SVG `feTurbulence` filter and the alchemy circle is inline SVG.
- **Hosting:** anything that serves static files

## Architecture

```
scripts/build_data.py       raw recipes + icon sets  ->  data/*.json, public/icons/*.svg
scripts/build_web_data.mjs  data/*.json              ->  public/puzzles/<n>.json (one per day)
app/, src/                  Next.js client, fetches /puzzles/<n>.json at runtime
```

### 1. Data pipeline (`scripts/build_data.py`)

Starts from a community-scraped Infinite Craft recipe dump (hundreds of thousands of combinations) and prunes it into something that works as a cozy puzzle:

- Drops abstract words, brands, real people and anything off-theme, collapses case duplicates and plurals, and only keeps elements that are reachable from the four base elements (Water, Fire, Earth, Wind).
- Matches every element to an icon. It tries an exact OpenMoji match first, then synonyms, then the head noun, then game-icons.net silhouettes. If nothing fits it generates a monogram SVG, and those never get used for puzzle tokens or targets.
- Merges in a small file of hand-written joke recipes (Fire + Alchemist = Singed Eyebrows).

The result is 2,551 elements and 40,814 recipes, stored as `[a, b, result]` id triples with `a <= b`, so an unordered pair maps to exactly one result.

The whole thing is seeded and deterministic. Running it twice gives byte-identical output.

### 2. Solver

The hard part is computing par exactly. Tokens are consumable, so any play sequence forms a forest of binary trees whose leaves are starting tokens. A tree with *k* leaves costs *k − 1* merges, which means:

```
par = min over token subsets S that can produce the target of (|S| - 1)
```

The solver runs a BFS over the subset lattice of token indices (not element names, so duplicate tokens are handled correctly):

```
crafted[S] = { recipe(x, y) : S = A ∪ B, A ∩ B = ∅, x ∈ crafted[A], y ∈ crafted[B] }
```

Subsets are processed in order of popcount. Each unordered split is enumerated once by forcing `A` to contain the lowest set bit of `S`, which gives roughly 3ⁿ/2 splits for n tokens (n ≤ 10 here, so about 30k). The first layer that contains the target is par.

Every puzzle is then checked two more ways:
1. the stored optimal path is replayed against a literal multiset simulation, and
2. a separate BFS over multiset board states confirms there's no shorter solution.

The generator also records how many distinct optimal recipe trees exist, a histogram of solutions by merge count, and how many reactions are reachable on the board. Those feed into a complexity score (a percentile across the whole set) that sets the difficulty stars and weights the end-of-game title.

### 3. Per-day bundles (`scripts/build_web_data.mjs`)

Shipping the full 520 KB recipe table to every player would be wasteful, since only a tiny slice of it is reachable from any given board. This script reruns the same subset DP in Node and collects every reaction that can actually happen on each day's board (any `x ∈ crafted[A]`, `y ∈ crafted[B]` with disjoint `A`, `B`). It writes one JSON file per day with just those reactions and the names/icons involved, about 10 KB on average and 54 KB at the largest.

As a sanity check it compares its reaction count against the Python solver's `possible_reactions` for every puzzle and fails the build on any mismatch. All 366 match.

It runs automatically before `npm run dev` and `npm run build`.

### 4. Frontend

- **Single client component (`src/components/Game.tsx`)** owns the game state. The rules themselves are plain functions in `src/lib/` with no React in them.
- **Free-form board.** Tokens store their position as fractions (0–1) of the board, so layouts survive window resizes and rotating a phone. On a new deal, tokens go in a ring around the center if the ring's perimeter leaves about 100 px per token, otherwise in a jittered grid.
- **Drag and drop with raw Pointer Events.** It uses `setPointerCapture` and `touch-action: none` so mouse, touch and pen all go through one code path. The drag transform is written straight to the DOM instead of React state, so moving a token doesn't re-render the board. Drop targets are found by distance to each icon's center. A failed merge animates back with the Web Animations API.
- **Tap to merge** as an alternative to dragging, plus keyboard support (Enter/Space to select, Escape to cancel).
- **Dead-end detection.** After every move it checks all pairs on the board against the day's reaction table (self-pairs only count with two copies). If nothing can react, it nudges you to Reset.
- **Share grid.** Each run keeps a merge log with token ids. On a win it walks backwards from the winning token to find which merges actually fed into it, then marks those 🟨 and the detours 🟪.
- **Persistence.** In-progress runs, results, streaks and the over-par distribution are saved in localStorage, versioned and checked against the puzzle's token list so stale saves get ignored.
- **Static export.** No server and no API routes. Archive and practice links use query params (`?n=12`) synced with `history.replaceState`.

## Running it

```bash
npm install
npm run dev        # builds the per-day bundles, then starts Next on :3000
npm run build      # static site in out/
npm run lint       # tsc --noEmit
```

To serve it from a sub-path (GitHub Pages, for example), set `NEXT_PUBLIC_BASE_PATH=/alchemdle` before building.

In dev, `?date=2026-12-05` pretends it's a different day, which is handy for testing future puzzles.

Regenerating the puzzle data (needs network the first time, then works from `.cache/`):

```bash
python scripts/build_data.py --days 366 --start 2026-11-17 --seed 1729
```

It takes about 5 minutes, mostly in puzzle generation and verification.

## Project layout

```
app/                  layout, page, global styles
src/components/       Game, panels (win, stats, archive, help), board decoration
src/lib/              game rules, titles, dates, storage, types
scripts/              data pipeline (Python) + per-day bundle builder (Node)
data/                 generated elements, recipes, daily puzzles
public/icons/         generated SVG icons
```

## Credits

- Emoji: [OpenMoji](https://openmoji.org), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Silhouette icons: Lorc, Delapouite and contributors at [game-icons.net](https://game-icons.net), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). I recoloured them and added a drop shadow.
- Recipe data: adapted from a community-collected Infinite Craft dataset (vantezzen)

This is a fan project and isn't affiliated with Infinite Craft or Little Alchemy.
