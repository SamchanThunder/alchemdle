#!/usr/bin/env python3
"""
Builds brainrot mode from data/brainrot.json.

Writes data/brainrot_elements.json, data/brainrot_recipes.json,
data/brainrot_puzzles.json and the emoji icons in public/icons/br/.
Usage: python scripts/build_brainrot.py [--report]
"""
import argparse
import collections
import datetime as dt
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import DATA, ICON_DIR, IconIndex, Solver, load_json, write_json  # noqa: E402

BR_ICONS = os.path.join(ICON_DIR, "br")
DIFFICULTY = {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="print every board's reactions")
    args = ap.parse_args()

    src = load_json(os.path.join(DATA, "brainrot.json"))
    emoji = src["elements"]
    errors = []

    # elements used by any recipe or puzzle, in file order
    used = set()
    for a, b, c, _ in src["recipes"]:
        used |= {a, b, c}
    for target, tokens in src["puzzles"]:
        used |= {target, *tokens}
    missing = sorted(used - set(emoji))
    if missing:
        sys.exit(f"no emoji for: {missing}")
    names = [n for n in emoji if n in used]
    ids = {n: i for i, n in enumerate(names)}

    # recipes: one result per unordered pair
    recipes = {}
    for a, b, c, _ in src["recipes"]:
        key = tuple(sorted((ids[a], ids[b])))
        if key in recipes and recipes[key] != ids[c]:
            errors.append(f"{a} + {b} has two results: {names[recipes[key]]}, {c}")
        recipes[key] = ids[c]
    nbr = collections.defaultdict(list)
    for (a, b), c in recipes.items():
        nbr[a].append((b, c))
        if a != b:
            nbr[b].append((a, c))
    solver = Solver(recipes, nbr)

    # icons: emoji -> OpenMoji svg
    icons = IconIndex(offline=True)
    os.makedirs(BR_ICONS, exist_ok=True)
    for f in os.listdir(BR_ICONS):
        os.remove(os.path.join(BR_ICONS, f))
    elements = []
    for n in names:
        key = icons.from_emoji(emoji[n])
        if not key:
            errors.append(f"no OpenMoji icon for {n} {emoji[n]}")
            continue
        slug = re.sub(r"[^a-z0-9-]", "", key.lower().replace(":", "-").replace(" ", "-"))
        with open(os.path.join(BR_ICONS, slug + ".svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(icons.svg(key))
        elements.append({"id": ids[n], "name": n, "icon": "br/" + slug, "emoji": emoji[n]})

    # puzzles
    start = dt.date.fromisoformat(src["start_date"])
    puzzles = []
    for i, (target, tokens) in enumerate(src["puzzles"]):
        num = i + 1
        t = ids[target]
        toks = [ids[x] for x in tokens]
        sol = solver.solve(toks, t)
        if not sol:
            errors.append(f"#{num} {target}: can't be made from {tokens}")
            continue
        par = sol["par"]
        if solver.replay(toks, sol["path"], t) != par:
            errors.append(f"#{num} replay mismatch")
        if solver.bfs_min_merges(toks, t, len(toks)) != par:
            errors.append(f"#{num} bfs disagrees on par")
        trees = solver.distinct_trees(toks, t)
        by_size = collections.Counter(len(solver.tree_steps(tr)) for tr in trees)
        used_mask = sol["mask"]
        distractors = [x for j, x in enumerate(toks) if not used_mask >> j & 1]
        rng = random.Random(src["seed"] * 1000 + num)
        shuffled = toks[:]
        rng.shuffle(shuffled)
        day = start + dt.timedelta(days=i)
        reactions = sol["reactions"]
        puzzles.append({
            "number": num,
            "date": day.isoformat(),
            "weekday": day.strftime("%A"),
            "target": t,
            "target_name": target,
            "par": par,
            "difficulty": DIFFICULTY.get(par, 5),
            "complexity": round(min(1.0, (par - 1) / 5), 3),
            "tokens": shuffled,
            "token_names": [names[x] for x in shuffled],
            "distractors": distractors,
            "optimal_path": sol["path"],
            "optimal_path_text": [f"{names[x]} + {names[y]} = {names[c]}" for x, y, c in sol["path"]],
            "optimal_routes": by_size.get(par, 1),
            "distinct_paths": len(trees),
            "routes_by_merges": {str(k): v for k, v in sorted(by_size.items())},
            "possible_reactions": len(reactions),
        })
        if args.report:
            print(f"#{num:2} {target:22} par {par}  reactions {len(reactions):2}  paths {len(trees)}")
            for (x, y), c in sorted(reactions.items(), key=lambda r: names[r[1]]):
                print(f"      {names[x]} + {names[y]} = {names[c]}")

    if errors:
        sys.exit("\n".join(errors))

    write_json(os.path.join(DATA, "brainrot_elements.json"), {"count": len(elements), "elements": elements})
    write_json(os.path.join(DATA, "brainrot_recipes.json"),
               {"count": len(recipes), "recipes": [[a, b, c] for (a, b), c in sorted(recipes.items())]}, compact=True)
    write_json(os.path.join(DATA, "brainrot_puzzles.json"), {
        "start_date": src["start_date"], "count": len(puzzles), "seed": src["seed"], "puzzles": puzzles})
    low = [p["possible_reactions"] for p in puzzles]
    print(f"wrote {len(elements)} elements, {len(recipes)} recipes, {len(puzzles)} puzzles; "
          f"reactions per board min {min(low)} avg {sum(low) / len(low):.1f}; "
          f"par mix {dict(collections.Counter(p['par'] for p in puzzles))}")


if __name__ == "__main__":
    main()
