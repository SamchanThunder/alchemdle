# Alchemdle

A daily alchemy merge puzzle. Players combine starting ingredients to make a target element in as few merges as possible. Each puzzle has a par (shown in-game as "Best"), the proven minimum number of merges.

Built as a static Next.js site. Puzzle generation and solving happen ahead of time in a Python pipeline, so the client only fetches a small JSON file per day.

**Live:** https://samchanthunder.github.io/alchemdle/

## Stack

- Python 3 (data pipeline, standard library only)
- Next.js 16 (App Router, static export), React 19, TypeScript
- Plain CSS and inline SVG
- GitHub Actions → GitHub Pages

## How it works

**Data pipeline** (`scripts/build_data.py`)
- Prunes a community Infinite Craft dataset (~206k recipes, 31.6k elements) down to 2,551 elements and 40,814 recipes reachable from the four base elements.
- Matches each element to an OpenMoji or game-icons.net icon.
- Generates 366 seeded daily puzzles: 4–5 starting elements, par 3–4, and at least 2 distinct winning recipe trees each.

**Solver**
- Tokens are single-use, so a solution is a binary tree over a subset of tokens, and par = min |S| − 1.
- BFS over the token-subset lattice: `crafted[S]` = results of `x ∈ crafted[A]`, `y ∈ crafted[B]` for each split S = A ∪ B. That is ~3ⁿ/2 splits for n tokens.
- Each puzzle is verified by replaying the optimal path, by a second BFS over multiset board states, and by a brute-force count of distinct recipe trees.

**Per-day bundles** (`scripts/build_web_data.mjs`)
- Precomputes only the reactions reachable on each board, so each file is ~10 KB on average instead of shipping the 520 KB recipe table.
- Fails the build if any count differs from the solver's.

**Frontend** (`src/components/Game.tsx`, `src/lib/`)
- Free-form board, with token positions stored as 0–1 fractions so they survive resizes.
- Drag and drop with Pointer Events (mouse, touch and pen), plus tap-to-merge and keyboard support.
- Detects dead ends where no pair can react, and builds a share grid by tracing which merges fed the final result.
- Stats, streaks and in-progress runs are saved in localStorage. Past puzzles can be replayed in practice mode.

## Running

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in out/
```

Rebuild the puzzle data with:

```bash
python scripts/build_data.py --days 366 --start 2026-11-17 --seed 1729
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds with the right base path and publishes `out/` to the root of the `gh-pages` branch. Pages is set to deploy from `gh-pages` / (root).

## Credits

- Emoji: [OpenMoji](https://openmoji.org), CC BY-SA 4.0
- Icons: Lorc, Delapouite and contributors at [game-icons.net](https://game-icons.net), CC BY 3.0 (recoloured)
- Recipe data adapted from a community Infinite Craft dataset (vantezzen)

Fan project, not affiliated with Infinite Craft or Little Alchemy.
