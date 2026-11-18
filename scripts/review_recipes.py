#!/usr/bin/env python3
"""
Lists recipes used in any winning path that haven't been reviewed yet.

Usage: python scripts/review_recipes.py [--out todo.txt]
Then add each one to "keep" or "drop" in data/recipe_review.json and rebuild.
"""
import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import DATA, Solver, recipe_key  # noqa: E402


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write the to-do list here instead of stdout")
    args = ap.parse_args()

    names = [e["name"] for e in load("elements.json")["elements"]]
    recipes = {(a, b): c for a, b, c in load("recipes.json")["recipes"]}
    nbr = collections.defaultdict(list)
    for (a, b), c in recipes.items():
        nbr[a].append((b, c))
        nbr[b].append((a, c))
    solver = Solver(recipes, nbr)

    path = os.path.join(DATA, "recipe_review.json")
    review = load("recipe_review.json") if os.path.exists(path) else {"keep": [], "drop": []}
    seen = set(review["keep"]) | set(review["drop"])

    uses = collections.Counter()
    for pz in load("daily_puzzles.json")["puzzles"]:
        for tree in solver.distinct_trees(pz["tokens"], pz["target"]):
            uses.update({recipe_key(names[x], names[y], names[c]) for x, y, c in solver.tree_steps(tree)})

    todo = sorted((k for k in uses if k not in seen), key=lambda k: (-uses[k], k.lower()))
    text = "\n".join(todo)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    else:
        print(text)
    print(f"{len(uses)} recipes in winning paths, {len(todo)} not reviewed yet", file=sys.stderr)


if __name__ == "__main__":
    main()
