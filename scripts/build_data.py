#!/usr/bin/env python3
"""
Builds the game data.

Outputs: data/elements.json, data/recipes.json, data/daily_puzzles.json, public/icons/*.svg

Usage: python scripts/build_data.py [--days 366] [--start 2026-11-17] [--seed 1729] [--offline]

Sources (cached in .cache/): Infinite Craft recipes, OpenMoji, game-icons.net.

Par = fewest merges to make the target from the starting tokens.
Found by BFS over token subsets, then double-checked by replay and a second BFS.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import functools
import hashlib
import json
import math
import os
import random
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
DATA = os.path.join(ROOT, "data")
ICON_DIR = os.path.join(ROOT, "public", "icons")

SOURCES = {
    "raw/recipes.json": "https://icscdn.vantezzen.io/recipes.json",
    "icons/openmoji.json": "https://cdn.jsdelivr.net/npm/@iconify-json/openmoji@1.2.3/icons.json",
    "icons/openmoji-chars.json": "https://cdn.jsdelivr.net/npm/@iconify-json/openmoji@1.2.3/chars.json",
    "icons/openmoji-meta.json": "https://cdn.jsdelivr.net/npm/openmoji@15.1.0/data/openmoji.json",
    "icons/game-icons.json": "https://cdn.jsdelivr.net/npm/@iconify-json/game-icons@1.2.1/icons.json",
}

BASE_ELEMENTS = ["Water", "Fire", "Earth", "Wind"]

# --- pruning knobs -----------------------------------------------------------
MAX_ELEMENTS = 3200          # cap on catalogue size (custom results added on top)
MAX_NAME_LEN = 20
MAX_WORDS = 2
TWO_WORD_RANK = 3200       # composed two-word names must be at least this popular
FALLBACK_RANK = 1800       # icon-less single words this popular still get in (custom emblem)

# Words that aren't brewable things.
STOPWORDS = set("""
a an the and or but not no never always forever alone lonely one two three four five six seven
eight nine ten zero normal empty nothing something everything anything micro latin crafting where
what when why how who like try yes maybe very more less most least much many some any all none
again also just only even still too so then than this that these those it its is are was were be
been being do does did done have has had will would shall should can could may might must
mega super ultra mini big small little large tiny huge giant new old good bad best worst first
last next same other another self free full half double triple single plus minus
negative positive cancelled discover always score number numbers alpha beta omega
""".split())

# Sensitive / not-cozy themes. Matched against every word of a name.
BLOCKLIST = set("""
suicide nazi nazis hitler rape rapist porn porno sex sexy nude naked terrorist terrorism genocide
slave slavery cocaine heroin meth crack weed marijuana holocaust isis kkk racist racism abuse
murder murderer massacre jesus christ allah muhammad prophet bible quran trump biden obama putin
stalin mussolini osama laden gun guns rifle shooting shooter assault war warfare
drunk alcoholic hangover beer vodka whiskey wine cigarette cigar tobacco drug drugs overdose
blood bloody corpse dead death die dying kill killer killing torture prison jail
diarrhea vomit puke
""".split())

# Brands, real people and not-cozy topics to skip.
IP_BLOCKLIST = set("""
batman superman mario luigi spongebob squidward patrick godzilla sharknado google aquaman minecraft
uber batmobile pokemon pikachu disney mickey barbie lego starbucks mcdonalds nike coca cola pepsi
marvel hulk spiderman ironman yoda vader jedi sith hogwarts harry gandalf sauron frodo hobbit shrek
simpsons bart pacman sonic zelda tetris fortnite roblox twitter facebook tiktok youtube instagram
netflix elon kardashian beyonce rihanna gaga bieber oprah einstein picasso galileo shakespeare
nirvana skeeter quagmire tarzan goku naruto doge pepe meme garfield snoopy kermit elmo grinch
buddha moses noah adam eve satan lucifer krishna zeus jehovah
depression diabetes poverty pregnant cancer disease aids
donald tesla cthulhu nemo tinkerbell gatorade bong cannabis abortion baptism homeless drown
ozymandias narcissist hut mcdonald wendy kfc subway disneyland pixar
""".split())
PHRASE_BLOCKLIST = {"mars bar", "pizza hut", "donald duck", "burger king", "star wars", "star trek", "iron man",
                    "spider man", "big mac", "happy meal", "red bull", "monster energy", "pac man", "mr bean"}

# Manual icons for names with no match.
ALIASES = {
    "mud": "gi:swamp", "marsh": "gi:reed", "bog": "gi:swamp", "swamp": "gi:swamp", "smog": "om:factory",
    "soup": "om:steaming-bowl", "seaweed": "gi:algae", "kelp": "gi:algae", "lake": "gi:lily-pads",
    "pond": "gi:lily-pads", "zoo": "gi:bird-cage", "mist": "om:fog", "universe": "om:milky-way",
    "internet": "om:globe-with-meridians", "alchemist": "om:alembic", "alchemy": "gi:bubbling-flask",
    "grandma": "om:old-woman", "grandpa": "om:old-man", "homework": "om:notebook-with-decorative-cover",
    "hunger": "om:fork-and-knife-with-plate", "history": "gi:scroll-unfurled", "dirt": "om:trowel",
    "soil": "om:potted-plant", "atlantis": "gi:greek-temple", "surfboard": "gi:surf-board",
    "judge": "gi:gavel", "marriage": "gi:big-diamond-ring", "leprechaun": "om:four-leaf-clover",
    "stonehenge": "gi:dolmen", "vacation": "gi:beach-ball", "invention": "om:light-bulb",
    "nightmare": "gi:screaming", "chaos": "om:cyclone", "cure": "om:syringe", "druid": "gi:holy-oak",
    "obsidian": "gi:crystal-cluster", "library": "om:books", "thief": "gi:domino-mask",
    "princess": "om:princess", "pluto": "om:ringed-planet", "origami": "gi:folded-paper",
    "myth": "gi:scroll-quill", "legend": "gi:scroll-quill", "pufferfish": "om:blowfish",
    "sculpture": "gi:stone-bust", "tomb": "gi:sarcophagus", "lemonade": "om:cup-with-straw",
    "garbage": "om:wastebasket", "trash": "om:wastebasket", "gasoline": "om:fuel-pump",
    "starfish": "gi:sea-star", "gravity": "om:red-apple", "oxygen": "gi:bubbles", "airship": "gi:zeppelin",
    "meteorite": "om:comet", "omelette": "om:cooking", "casino": "om:slot-machine", "tiki": "gi:totem-head",
    "salsa": "om:hot-pepper", "sandcastle": "gi:sand-castle", "cough": "om:sneezing-face",
    "sauna": "om:person-in-steamy-room", "leviathan": "gi:sea-serpent", "empire": "gi:crown",
    "kingdom": "om:castle", "detective": "om:detective", "apocalypse": "gi:bright-explosion",
    "cruise": "om:passenger-ship", "firefly": "om:beetle", "snot": "om:sneezing-face",
    "graffiti": "gi:spray", "shipwreck": "gi:sinking-ship", "mirage": "gi:oasis", "oasis": "gi:oasis",
    "recipe": "om:open-book", "riddle": "gi:egyptian-sphinx", "philosophy": "om:thinking-face",
    "airport": "om:airplane-departure", "college": "om:graduation-cap", "gator": "om:crocodile",
    "pork": "gi:bacon", "laughter": "om:rolling-on-the-floor-laughing", "hay": "om:sheaf-of-rice",
    "lawn": "gi:high-grass", "lawnmower": "om:lawn-mower", "crop": "gi:corn", "continent": "om:world-map",
    "eternity": "om:infinity", "memory": "om:thought-balloon", "clone": "om:dna", "genius": "om:light-bulb",
    "artist": "om:artist-palette", "yeti": "gi:ape", "mudslide": "gi:falling-rocks",
    "politician": "gi:public-speaker", "politics": "gi:public-speaker", "election": "om:ballot-box-with-ballot",
    "democracy": "om:ballot-box-with-ballot", "divorce": "om:broken-heart", "accident": "om:collision",
    "crash": "om:collision", "disaster": "om:collision", "success": "om:trophy", "victory": "om:trophy",
    "comedy": "om:performing-arts", "tragedy": "om:performing-arts",
    "reality": "om:eye", "revolution": "gi:fist", "retirement": "om:beach-with-umbrella",
    "allergy": "om:sneezing-face", "steamboat": "om:ship",
    "lawyer": "gi:gavel", "lawsuit": "gi:gavel", "trial": "gi:gavel", "bride": "om:person-with-veil",
    "tourist": "om:camera-with-flash", "market": "om:shopping-cart",
    "dinner": "om:fork-and-knife-with-plate", "dustbin": "om:wastebasket", "ark": "om:ship",
    "fun": "om:party-popper", "wish": "om:shooting-star", "scandal": "om:newspaper", "tax": "om:receipt",
    "fireman": "om:firefighter", "titan": "gi:muscle-up", "charity": "om:handshake", "vaccine": "om:syringe",
    "mutant": "gi:mutant", "exam": "om:memo", "pterodactyl": "gi:pterodactylus",
    "work": "om:briefcase", "future": "om:crystal-ball", "conspiracy": "om:eye", "sale": "om:label",
    "parade": "om:confetti-ball", "sailor": "om:anchor", "thanksgiving": "om:poultry-leg", "math": "om:abacus",
    "summer": "om:sun-with-face", "engineer": "om:construction-worker", "photographer": "om:camera-with-flash",
    "fame": "om:star-struck", "celebrity": "om:star-struck", "restaurant": "om:fork-and-knife-with-plate",
    "story": "om:open-book", "spam": "om:envelope-with-arrow", "student": "om:student", "hacker": "om:technologist",
    "darkness": "om:new-moon", "fair": "om:ferris-wheel", "parking": "om:automobile",
    "truth": "om:magnifying-glass-tilted-left", "rumor": "om:speak-no-evil-monkey", "gossip": "om:speech-balloon",
    "racecar": "om:racing-car", "painter": "om:artist", "debt": "om:money-with-wings", "bankrupt": "om:money-with-wings",
    "blog": "om:memo", "marathon": "om:person-running", "settlement": "om:house", "professor": "om:teacher",
    "business": "om:briefcase", "poetry": "gi:quill-ink", "photograph": "om:framed-picture", "pension": "om:old-man",
    "astronomer": "om:telescope", "fitness": "om:flexed-biceps", "theory": "om:thinking-face", "sandman": "om:zzz",
    "punishment": "gi:gavel", "smell": "om:nose", "answer": "om:light-bulb", "trainwreck": "om:collision",
    "therapy": "om:couch-and-lamp", "fate": "om:crystal-ball", "patience": "om:hourglass-not-done",
    "foghorn": "om:loudspeaker", "failure": "om:cross-mark", "tattoo": "gi:tattoo", "friendship": "om:handshake",
    "beauty": "om:sparkles", "weekend": "om:beach-with-umbrella", "day": "om:sun", "faith": "om:folded-hands",
    "worker": "om:construction-worker", "recession": "om:chart-decreasing", "impossible": "om:infinity",
    "slip": "gi:banana-peel", "propaganda": "om:loudspeaker", "paparazzi": "om:camera-with-flash",
    "pangaea": "om:world-map", "hermit": "gi:hermit-crab", "microwave": "gi:microwave", "sacrifice": "om:dagger",
    "destruction": "om:collision", "steam": "gi:steam", "life": "gi:sprout", "energy": "om:high-voltage",
    "pressure": "gi:pressure-cooker", "love": "om:red-heart", "magic": "gi:magic-swirl", "potion": "gi:magic-potion",
    # high-traffic elements where the automatic match picked something odd
    "water": "om:droplet", "puddle": "gi:water-splash", "plant": "om:seedling", "time": "om:hourglass-not-done",
    "engine": "om:gear", "animal": "om:paw-prints", "ocean": "om:water-wave", "pirate": "gi:pirate-captain",
    "statue": "om:moai", "car": "om:automobile", "surfer": "om:person-surfing", "sand": "gi:sands-of-time",
    "money": "om:dollar-banknote", "titanic": "om:passenger-ship", "dinosaur": "om:sauropod",
    "storm": "om:cloud-with-lightning-and-rain", "rain": "om:cloud-with-rain", "planet": "om:ringed-planet",
    "pluto": "gi:planet-core", "snow": "om:snowflake", "gold": "gi:gold-bar", "treasure": "gi:open-treasure-chest",
    "boat": "om:sailboat", "witch": "gi:witch-face", "clock": "om:mantelpiece-clock",
    "christmas": "om:christmas-tree", "angel": "om:baby-angel", "smoke": "gi:smoke-bomb", "desert": "om:desert",
    "rich": "om:money-bag", "sandstorm": "gi:sandstorm",
}

# OpenMoji groups / subgroups that never make good element emblems
OM_SKIP_GROUPS = {"flags", "component"}
OM_SKIP_SUBGROUPS = {"brand", "ui-element", "flags", "interaction", "keycap", "alphanum",
                     "arrow", "av-symbol", "other-symbol", "geometric", "math", "punctuation",
                     "currency", "zodiac", "religion", "gender", "warning", "transport-sign",
                     "family", "person-gesture", "hand-fingers-open",
                     "hand-fingers-partial", "hand-single-finger", "hand-fingers-closed", "hands"}

# --- puzzle knobs --------------------------------------------------------------
PAR_MIN, PAR_MAX = 3, 4
MIN_TOKENS, MAX_TOKENS = 4, 5   # par can't exceed tokens - 1
MIN_PATHS = 2                   # distinct recipe trees that make the target
# weekday (Mon=0) -> (par, token count); spare tokens are red herrings
WEEKDAY_PLAN = {0: (3, 4), 1: (3, 5), 2: (3, 5), 3: (4, 5), 4: (4, 5), 5: (4, 5), 6: (3, 5)}
TARGET_COOLDOWN_DAYS = 180   # a target may return after this many days, always on a new board


# ============================================================================
# helpers
# ============================================================================
def log(*a):
    print("[build]", *a, flush=True)


def fetch(rel: str, offline: bool) -> str:
    path = os.path.join(CACHE, rel)
    if not os.path.exists(path):
        if offline:
            sys.exit(f"missing cached source {path} (run without --offline)")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        log("downloading", SOURCES[rel])
        req = urllib.request.Request(SOURCES[rel], headers={"User-Agent": "alchemdle-build/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path + ".part", "wb") as f:
            f.write(r.read())
        os.replace(path + ".part", path)
    return path


def recipe_key(a: str, b: str, c: str) -> str:
    """Name key used in data/recipe_review.json."""
    x, y = sorted((a, b), key=str.lower)
    return f"{x} + {y} = {c}"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj, compact=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)


def norm(s: str) -> str:
    s = s.lower().replace("-", " ").replace("_", " ")
    s = re.sub(r"[^a-z' ]", "", s).replace("'", "")
    return " ".join(s.split())


def singular(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith(("ches", "shes", "sses", "xes", "zes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is", "os")):
        return w[:-1]
    return w


def stable_hash(s: str) -> int:
    return int(hashlib.md5(s.encode("utf-8")).hexdigest()[:8], 16)


# ============================================================================
# 1. icon index
# ============================================================================
class IconIndex:
    """Finds an icon for each element name."""

    def __init__(self, offline: bool):
        self.om = load_json(fetch("icons/openmoji.json", offline))
        self.gi = load_json(fetch("icons/game-icons.json", offline))
        chars = load_json(fetch("icons/openmoji-chars.json", offline))
        meta = load_json(fetch("icons/openmoji-meta.json", offline))
        self.chars = chars

        self.exact: dict[str, tuple[int, str]] = {}   # phrase -> (quality, key)
        self.tag: dict[str, str] = {}                 # tag -> key
        self.gi_word: dict[str, str] = {}             # word -> shortest game-icon containing it as first/last token

        def put(d, k, v):
            if k and k not in d:
                d[k] = v

        def om_name_for(hexcode: str):
            h = hexcode.lower()
            return chars.get(h) or chars.get(h.replace("-fe0f", "")) or chars.get(h + "-fe0f")

        # OpenMoji first: colourful cartoon art is the preferred style.
        for m in meta:
            if m["group"] in OM_SKIP_GROUPS or m["subgroups"] in OM_SKIP_SUBGROUPS or m.get("skintone"):
                continue
            name = om_name_for(m["hexcode"])
            if not name or name not in self.om["icons"]:
                continue
            key = "om:" + name
            ann = m["annotation"]
            if ":" in ann:
                continue
            a = norm(ann)
            put(self.exact, a, (3, key))
            put(self.exact, singular(a), (3, key))
            for t in (m.get("tags", "") + "," + m.get("openmoji_tags", "")).split(","):
                t = norm(t)
                if t and t not in STOPWORDS:
                    put(self.tag, t, key)
                    put(self.tag, singular(t), key)
        self.aliases = {}
        bad = []
        for k, v in ALIASES.items():
            if v[3:] in (self.om if v.startswith("om:") else self.gi)["icons"]:
                self.aliases[norm(k)] = v
            else:
                bad.append(f"{k}->{v}")
        if bad:
            log(f"aliases with unknown icon (ignored): {', '.join(bad)}")
        # game-icons: silhouettes, used when OpenMoji has nothing.
        for name in sorted(self.gi["icons"], key=lambda n: (len(n), n)):
            key = "gi:" + name
            phrase = norm(name)
            put(self.exact, phrase, (3, key))
            put(self.exact, singular(phrase), (3, key))
            toks = phrase.split()
            for w in {toks[0], toks[-1]}:
                if w not in STOPWORDS and len(w) > 2:
                    put(self.gi_word, w, key)
                    put(self.gi_word, singular(w), key)

    def match(self, name: str) -> tuple[int, str | None]:
        """Best icon match as (quality, key). Higher is better."""
        n = norm(name)
        cands = [n, singular(n)]
        for c in cands:
            if c in self.aliases:
                return 3, self.aliases[c]
        for c in cands:
            if c in self.exact:
                return self.exact[c]
        for c in cands:
            if c in self.tag:
                return 2, self.tag[c]
        words = n.split()
        if len(words) == 1:
            for c in cands:
                if c in self.gi_word:
                    return 2, self.gi_word[c]
            return 0, None
        # multi-word: head noun (last word), then first word
        for w in (words[-1], words[0]):
            for c in (w, singular(w)):
                if c in STOPWORDS:
                    continue
                if c in self.exact:
                    return 1, self.exact[c][1]
                if c in self.tag:
                    return 1, self.tag[c]
                if c in self.gi_word:
                    return 1, self.gi_word[c]
        return 0, None

    def from_emoji(self, emoji: str) -> str | None:
        h = "-".join(f"{ord(ch):x}" for ch in emoji)
        for cand in (h, h.replace("-fe0f", ""), h + "-fe0f"):
            if cand in self.chars and self.chars[cand] in self.om["icons"]:
                return "om:" + self.chars[cand]
        return None

    def svg(self, key: str) -> str:
        if key.startswith("om:"):
            body = self.om["icons"][key[3:]]["body"]
            return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">{body}</svg>'
        if key.startswith("gi:"):
            name = key[3:]
            body = self.gi["icons"][name]["body"]
            fill = GI_PALETTE[stable_hash(name) % len(GI_PALETTE)]
            body = body.replace("currentColor", fill)
            # soft drop shadow so silhouettes read as embossed emblems
            return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -32 576 576">'
                    '<defs><filter id="s" x="-10%" y="-10%" width="120%" height="120%">'
                    '<feDropShadow dx="0" dy="10" stdDeviation="6" flood-color="#2a1606" flood-opacity=".35"/>'
                    f'</filter></defs><g filter="url(#s)">{body}</g></svg>')
        raise KeyError(key)


GI_PALETTE = ["#7b3fa0", "#2f6fb3", "#1f8a70", "#c0562b", "#b8342f", "#8a6a1f", "#3d5a80", "#9c3d6e"]


def fallback_svg(name: str) -> str:
    """Fallback icon: a ring with the first letter."""
    h = stable_hash(name) % 360
    letter = (name.strip()[:1] or "?").upper()
    letter = {"&": "&amp;", "<": "&lt;", ">": "&gt;"}.get(letter, letter)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">'
        f'<defs><radialGradient id="g" cx="40%" cy="35%" r="70%">'
        f'<stop offset="0" stop-color="hsl({h},70%,72%)"/><stop offset="1" stop-color="hsl({h},55%,38%)"/>'
        '</radialGradient></defs>'
        '<circle cx="36" cy="36" r="27" fill="url(#g)" stroke="#3b2414" stroke-width="2"/>'
        '<circle cx="36" cy="36" r="21" fill="none" stroke="#fff6dc" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 3"/>'
        '<polygon points="36,13 56,47 16,47" fill="none" stroke="#fff6dc" stroke-opacity=".35" stroke-width="1.2"/>'
        f'<text x="36" y="45" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="26" '
        f'fill="#fff6dc" stroke="#3b2414" stroke-width=".8">{letter}</text></svg>'
    )


# ============================================================================
# 2. load + prune the recipe graph
# ============================================================================
def name_ok(name: str, allow=frozenset()) -> bool:
    if not re.fullmatch(r"[A-Za-z][A-Za-z' ]*[A-Za-z]", name):
        return False
    if len(name) > MAX_NAME_LEN:
        return False
    words = norm(name).split()
    if not words or len(words) > MAX_WORDS or " ".join(words) in PHRASE_BLOCKLIST:
        return False
    if any((w in BLOCKLIST or w in IP_BLOCKLIST) and w not in allow for w in words):
        return False
    if len(words) == 1 and words[0] in STOPWORDS:
        return False
    if all(w in STOPWORDS for w in words):
        return False
    if name.isupper() and len(name) > 1:          # acronyms
        return False
    return True


def prune(raw, icons: IconIndex):
    items, R = raw["items"], raw["recipes"]
    pop = collections.Counter()
    for a, b, c in R:
        pop[a] += 1
        pop[b] += 1
        pop[c] += 1

    # merge case duplicates into the most popular spelling
    by_norm: dict[str, int] = {}
    for i, nm in enumerate(items):
        k = norm(nm)
        if k and (k not in by_norm or pop[i] > pop[by_norm[k]]):
            by_norm[k] = i

    pop_rank = {i: r for r, i in enumerate(sorted(range(len(items)), key=lambda i: -pop[i]))}
    fallback_ok = lambda i: pop_rank[i] < FALLBACK_RANK and items[i][:1].isupper() and not items[i][1:].isupper()
    match = {}
    single_vocab = set()
    for i, nm in enumerate(items):
        if by_norm.get(norm(nm)) != i or not name_ok(nm):
            continue
        q, key = icons.match(nm)
        if not q and " " not in nm and fallback_ok(i):
            q, key = 2, None                     # popular plain word: custom fallback emblem
        if q:
            match[i] = (q, key)
            if q >= 2 and " " not in nm:
                single_vocab.add(norm(nm))

    def recognisable(i):
        nm = items[i]
        q, _ = match[i]
        words = norm(nm).split()
        if len(words) == 1:
            if q < 2:
                return False
            # drop plurals ("Cows" when "Cow" exists)
            s = singular(words[0])
            if s != words[0] and s in by_norm and by_norm[s] in match:
                return False
            return True
        # two words: needs an exact icon or two known words
        return q == 3 or (pop_rank[i] < TWO_WORD_RANK
                          and all(w in single_vocab or singular(w) in single_vocab for w in words))

    keep = [i for i in match if recognisable(i)]
    keep.sort(key=lambda i: -pop[i])
    base_idx = [by_norm[norm(b)] for b in BASE_ELEMENTS]
    chosen = set(keep[:MAX_ELEMENTS]) | set(base_idx)

    # keep only what is reachable from the base four
    while True:
        rec = {}
        for a, b, c in R:
            if a in chosen and b in chosen and c in chosen and c not in (a, b):
                k = (min(a, b), max(a, b))
                rec.setdefault(k, c)          # first occurrence wins (deterministic)
        reach = set(base_idx)
        changed = True
        nbr = collections.defaultdict(list)
        for (a, b), c in rec.items():
            nbr[a].append((b, c))
            nbr[b].append((a, c))
        frontier = list(reach)
        while frontier:
            nxt = []
            for x in frontier:
                for y, c in nbr[x]:
                    if y in reach and c not in reach:
                        reach.add(c)
                        nxt.append(c)
            frontier = nxt
        if reach == chosen:
            break
        chosen = reach
    return items, pop, match, chosen, rec, base_idx


# ============================================================================
# 3. catalogue assembly (+ custom funny recipes)
# ============================================================================
def build_catalogue(items, pop, match, chosen, rec, base_idx, icons: IconIndex):
    order = base_idx + sorted((i for i in chosen if i not in base_idx), key=lambda i: (-pop[i], items[i]))
    rid = {raw: new for new, raw in enumerate(order)}
    elements = []
    for raw in order:
        q, key = match.get(raw, (0, None))
        elements.append({"id": rid[raw], "name": items[raw], "icon": key,
                         "pop": pop[raw], "custom": False, "q": q if key else 0})
    recipes = {}
    for (a, b), c in rec.items():
        x, y = sorted((rid[a], rid[b]))
        recipes[(x, y)] = rid[c]

    # merge the hand-written funny recipes
    by_name = {norm(e["name"]): e["id"] for e in elements}
    raw_by_norm = {}
    for i, nm in enumerate(items):
        raw_by_norm.setdefault(norm(nm), i)
    custom = load_json(os.path.join(DATA, "custom_funny_recipes.json"))["recipes"]
    added, skipped = 0, []

    def ensure(name, icon_hint=None, from_custom=False):
        k = norm(name)
        if k in by_name:
            return by_name[k]
        if not from_custom:
            return None
        eid = len(elements)
        icon = None
        if icon_hint:
            icon = icon_hint if icon_hint.startswith(("gi:", "om:")) else icons.from_emoji(icon_hint)
        if not icon:
            icon = icons.match(name)[1]
        raw = raw_by_norm.get(k)
        elements.append({"id": eid, "name": name, "icon": icon, "pop": pop[raw] if raw is not None else 0,
                         "custom": True, "q": 3 if icon else 0})
        by_name[k] = eid
        return eid

    for r in custom:
        a, b = ensure(r["a"]), ensure(r["b"])
        if a is None or b is None:
            skipped.append(f'{r["a"]} + {r["b"]}')
            continue
        c = ensure(r["result"], r.get("icon"), from_custom=True)
        if c in (a, b):
            continue
        recipes[tuple(sorted((a, b)))] = c
        if r.get("icon"):
            elements[c]["icon"] = elements[c]["icon"] or icons.from_emoji(r["icon"])
        elements[c]["custom"] = True
        added += 1
    log(f"custom recipes: {added} merged, {len(skipped)} skipped (missing ingredients)")
    if skipped:
        log("  skipped:", ", ".join(skipped))

    # remove recipes marked "drop" in data/recipe_review.json
    review_path = os.path.join(DATA, "recipe_review.json")
    drop = set(load_json(review_path).get("drop", [])) if os.path.exists(review_path) else set()
    if drop:
        name = lambda i: elements[i]["name"]
        bad = [k for k, c in recipes.items() if recipe_key(name(k[0]), name(k[1]), name(c)) in drop]
        for k in bad:
            del recipes[k]
        log(f"review: dropped {len(bad)} recipes")

    # fewest crafts from the base four
    nbr = collections.defaultdict(list)
    for (a, b), c in recipes.items():
        nbr[a].append((b, c))
        nbr[b].append((a, c))
    depth = {i: 0 for i in range(len(BASE_ELEMENTS))}
    frontier = list(depth)
    d = 0
    while frontier:
        d += 1
        nxt = []
        for x in frontier:
            for y, c in nbr[x]:
                if y in depth and c not in depth:
                    depth[c] = d
                    nxt.append(c)
        frontier = nxt
    for e in elements:
        e["depth"] = depth.get(e["id"], -1)
        if not e["icon"]:
            e["icon"] = "fb:" + e["name"]
    return elements, recipes, nbr


# ============================================================================
# 4. solver
# ============================================================================
class Solver:
    def __init__(self, recipes: dict, nbr):
        self.recipes = recipes
        self.nbr = nbr

    def react(self, x, y):
        return self.recipes.get((x, y) if x <= y else (y, x))

    def lattice(self, tokens, max_size=None):
        """What each token subset can make, plus all board reactions."""
        n = len(tokens)
        full = (1 << n) - 1
        max_size = max_size or n
        crafted = [None] * (1 << n)
        for i, t in enumerate(tokens):
            crafted[1 << i] = {t: (1, None)}
        reactions = {}
        masks = sorted(range(1, full + 1), key=lambda m: bin(m).count("1"))
        for mask in masks:
            k = bin(mask).count("1")
            if k < 2 or k > max_size:
                continue
            out = {}
            low = mask & -mask
            sub = (mask - 1) & mask
            while sub:
                if sub & low:                       # each unordered split once
                    A, B = sub, mask ^ sub
                    ca, cb = crafted[A], crafted[B]
                    if ca and cb:
                        if len(ca) > len(cb):
                            ca, cb, A, B = cb, ca, B, A
                        for x, (wx, _) in ca.items():
                            for y, c in self.nbr.get(x, ()):
                                if y in cb:
                                    wy = cb[y][0]
                                    reactions[(min(x, y), max(x, y))] = c
                                    if c in out:
                                        out[c] = (out[c][0] + wx * wy, out[c][1])
                                    else:
                                        out[c] = (wx * wy, (A, x, B, y))
                sub = (sub - 1) & mask
            crafted[mask] = out
        return crafted, reactions

    @staticmethod
    def path(crafted, mask, elem):
        """Merge steps that build elem from the tokens in mask."""
        info = crafted[mask][elem]
        if info[1] is None:
            return []
        A, x, B, y = info[1]
        return Solver.path(crafted, A, x) + Solver.path(crafted, B, y) + [[x, y, elem]]

    def solve(self, tokens, target):
        crafted, reactions = self.lattice(tokens)
        best = None
        ways_by_size = collections.Counter()
        leafsets = collections.Counter()
        for mask in range(1, 1 << len(tokens)):
            if crafted[mask] and target in crafted[mask]:
                k = bin(mask).count("1")
                if k == 1:
                    continue
                ways_by_size[k - 1] += crafted[mask][target][0]
                leafsets[k - 1] += 1
                if best is None or k < bin(best).count("1"):
                    best = mask
        if best is None:
            return None
        par = bin(best).count("1") - 1
        return {
            "par": par,
            "mask": best,
            "path": self.path(crafted, best, target),
            "ways_by_merges": dict(sorted(ways_by_size.items())),
            "leafsets_by_merges": dict(sorted(leafsets.items())),
            "reactions": reactions,
            "craftable": set().union(*(set(c) for c in crafted if c)),
        }

    def distinct_trees(self, tokens, target):
        """Brute force: every distinct recipe tree that makes target (small boards only)."""
        n = len(tokens)

        @functools.lru_cache(maxsize=None)
        def build(mask):
            if mask & (mask - 1) == 0:
                t = tokens[mask.bit_length() - 1]
                return frozenset({(t, t)})
            out = set()
            low = mask & -mask
            sub = (mask - 1) & mask
            while sub:
                if sub & low:
                    for x, tx in build(sub):
                        for y, ty in build(mask ^ sub):
                            c = self.react(x, y)
                            if c is not None:
                                out.add((c, tuple(sorted((tx, ty), key=repr))))
                sub = (sub - 1) & mask
            return frozenset(out)

        trees = set()
        for mask in range(1, 1 << n):
            if mask & (mask - 1):
                trees |= {t for e, t in build(mask) if e == target}
        return trees

    def tree_steps(self, tree):
        """(x, y, result) for every merge in a recipe tree."""
        steps = []

        def walk(t):
            if isinstance(t, int):
                return t
            x, y = walk(t[0]), walk(t[1])
            c = self.react(x, y)
            steps.append((x, y, c))
            return c

        walk(tree)
        return steps

    # ---- double checks
    def replay(self, tokens, path, target) -> int:
        """Replays the path. Returns the merge count."""
        board = collections.Counter(tokens)
        for x, y, c in path:
            if board[x] < 1 or board[y] < (2 if x == y else 1):
                raise AssertionError(f"token not available: {x}+{y}")
            if self.react(x, y) != c:
                raise AssertionError(f"bad recipe {x}+{y}")
            board[x] -= 1
            board[y] -= 1
            board[c] += 1
        if board[target] < 1:
            raise AssertionError("target not produced")
        return len(path)

    def bfs_min_merges(self, tokens, target, limit, state_cap=400_000):
        """Plain BFS check. Min merges, None if unreachable, -1 if capped."""
        start = tuple(sorted(tokens))
        if target in start:
            return 0
        seen = {start}
        layer = [start]
        for depth in range(1, limit + 1):
            nxt = []
            for st in layer:
                n = len(st)
                for i in range(n):
                    if i and st[i] == st[i - 1]:
                        continue
                    for j in range(i + 1, n):
                        if j > i + 1 and st[j] == st[j - 1]:
                            continue
                        c = self.react(st[i], st[j])
                        if c is None:
                            continue
                        if c == target:
                            return depth
                        ns = list(st[:i] + st[i + 1:j] + st[j + 1:]) + [c]
                        ns = tuple(sorted(ns))
                        if ns not in seen:
                            seen.add(ns)
                            nxt.append(ns)
                if len(seen) > state_cap:
                    return -1
            layer = nxt
        return None


# ============================================================================
# 5. puzzle generator
# ============================================================================
class Generator:
    def __init__(self, elements, recipes, nbr, seed, approved=None):
        self.approved = approved   # reviewed "keep" pairs; winning paths stick to these
        self.E = elements
        self.recipes = recipes
        self.nbr = nbr
        self.rng = random.Random(seed)
        self.solver = Solver(recipes, nbr)
        self.producers = collections.defaultdict(list)
        for (a, b), c in recipes.items():
            self.producers[c].append((a, b))

        good_icon = lambda e: e["q"] >= 2 and not e["icon"].startswith("fb")
        n = len(elements)
        ranked = sorted(range(n), key=lambda i: -elements[i]["pop"])
        rank = {i: r for r, i in enumerate(ranked)}
        self.rank = rank
        # familiar elements make good starting tokens
        self.familiar = {i for i in range(n)
                         if rank[i] < 700 and elements[i]["q"] == 3 and good_icon(elements[i])
                         and elements[i]["depth"] >= 0 and len(elements[i]["name"].split()) == 1}
        # path steps should be recognisable too
        self.legible = {i for i in range(n) if good_icon(elements[i]) and (rank[i] < 1800 or elements[i]["custom"])}
        # target pool: recognisable, at least a few steps from the base four
        self.targets = [i for i in range(n)
                        if elements[i]["q"] == 3 and good_icon(elements[i]) and elements[i]["depth"] >= 3
                        and (rank[i] < 1800 or elements[i]["custom"])
                        and len(self.producers[i]) >= 1]
        # favour the funny custom recipes as targets
        self.targets += [i for i in self.targets if elements[i]["custom"]] * 3
        self.fam_weight = {i: 1.0 / (1 + rank[i] / 150) for i in range(n)}
        log(f"generator: {len(self.familiar)} familiar leaf elements, {len(self.targets)} target candidates")

    def sample_tree(self, target, merges):
        rng = self.rng
        leaves = [target]
        interior = {target}
        for step in range(merges):
            # break down the least familiar leaf first
            opts = [k for k, x in enumerate(leaves) if self.producers[x] and (step == 0 or x not in self.familiar
                                                                              or rng.random() < 0.25)]
            if not opts:
                return None
            opts.sort(key=lambda k: (self.rank[leaves[k]] < 700, rng.random()))
            k = opts[0] if rng.random() < 0.8 else rng.choice(opts)
            x = leaves[k]
            cands = [(a, b) for a, b in self.producers[x]
                     if a not in interior and b not in interior and a != target and b != target
                     and a in self.legible and b in self.legible]
            if not cands:
                return None
            w = [self.fam_weight[a] * self.fam_weight[b] * (1.5 if (a in self.familiar and b in self.familiar) else 1)
                 for a, b in cands]
            a, b = rng.choices(cands, weights=w)[0]
            leaves[k:k + 1] = [a, b]
            interior.add(x)
        return leaves

    def make(self, par, n_tokens, used_targets, used_boards, day, cooldown, tries=4000, strict=True):
        rng = self.rng
        n_distractors = n_tokens - par - 1
        if n_distractors < 0:
            return None
        for _ in range(tries):
            target = rng.choice(self.targets)
            if target in used_targets and day - used_targets[target] < cooldown:
                continue
            leaves = self.sample_tree(target, par)
            if not leaves or any(l not in self.familiar for l in leaves):
                continue
            if len(set(leaves)) < len(leaves) - 1:           # at most one duplicate token
                continue
            # red herrings that still react with something
            board_set = set(leaves)
            pool = [d for d in self.familiar if d != target and d not in board_set
                    and any(y in board_set for y, _ in self.nbr.get(d, ()))]
            if len(pool) < n_distractors:
                continue
            distractors = rng.sample(pool, n_distractors)
            tokens = leaves + distractors
            if not MIN_TOKENS <= len(tokens) <= MAX_TOKENS:
                continue
            key = tuple(sorted(tokens)) + (target,)
            if key in used_boards:
                continue
            sol = self.solver.solve(tokens, target)
            if not sol or not (PAR_MIN <= sol["par"] <= PAR_MAX) or sol["par"] != par:
                continue
            trees = self.solver.distinct_trees(tokens, target)
            if len(trees) < MIN_PATHS:                        # need more than one way to win
                continue
            if strict and self.approved and any(
                    (min(x, y), max(x, y)) not in self.approved
                    for t in trees for x, y, _ in self.solver.tree_steps(t)):
                continue                                      # every winning step must be reviewed
            sol["distinct_paths"] = len(trees)
            n_react = len(sol["reactions"])
            if n_react < len(tokens) + par:                   # board must be playful, not a corridor
                continue
            rng.shuffle(tokens)
            return target, tokens, distractors, sol
        return None


def complexity_raw(par, n_tokens, sol):
    """Higher = harder."""
    opt_ways = max(1, sol["ways_by_merges"].get(par, 1))
    extra = n_tokens - (par + 1)
    return par + 0.35 * extra + 0.15 * math.log2(1 + len(sol["reactions"])) - 0.4 * math.log2(opt_ways)


PAR_STAR_BASE = {3: 2.0, 4: 3.5}


def assign_difficulty(puzzles):
    """1-5 stars from par, nudged by complexity."""
    by_par = collections.defaultdict(list)
    for pz in puzzles:
        by_par[pz["par"]].append(pz["_complexity_raw"])
    for pz in puzzles:
        vals = by_par[pz["par"]]
        pct = sum(v <= pz["_complexity_raw"] for v in vals) / len(vals)
        pz["difficulty"] = max(1, min(5, round(PAR_STAR_BASE[pz["par"]] + (pct - 0.5) * 1.6)))


# ============================================================================
# main
# ============================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=366)
    ap.add_argument("--start", default="2026-11-17")
    ap.add_argument("--seed", type=int, default=1729)
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()
    t0 = time.time()

    raw = load_json(fetch("raw/recipes.json", args.offline))
    log(f"raw dataset: {len(raw['items'])} items, {len(raw['recipes'])} recipes")
    icons = IconIndex(args.offline)

    items, pop, match, chosen, rec, base_idx = prune(raw, icons)
    log(f"pruned: {len(chosen)} elements, {len(rec)} recipes")
    elements, recipes, nbr = build_catalogue(items, pop, match, chosen, rec, base_idx, icons)

    # ---- icons -> public/icons/<slug>.svg ------------------------------------------
    os.makedirs(ICON_DIR, exist_ok=True)
    for f in os.listdir(ICON_DIR):
        if f.endswith(".svg"):
            os.remove(os.path.join(ICON_DIR, f))
    written = {}
    src_count = collections.Counter()
    for e in elements:
        key = e["icon"]
        slug = re.sub(r"[^a-z0-9-]", "", key.lower().replace(":", "-").replace(" ", "-").replace("'", ""))
        if slug not in written:
            svg = fallback_svg(key[3:]) if key.startswith("fb:") else icons.svg(key)
            with open(os.path.join(ICON_DIR, slug + ".svg"), "w", encoding="utf-8", newline="\n") as f:
                f.write(svg)
            written[slug] = key
        e["icon"] = slug
        src_count[key[:2]] += 1
    log(f"icons: {len(written)} svg files ({dict(src_count)} elements by source om/gi/fb)")

    # ---- elements / recipes ----------------------------------------------------------
    write_json(os.path.join(DATA, "elements.json"), {
        "version": 1,
        "count": len(elements),
        "base": list(range(len(BASE_ELEMENTS))),
        "fields": "id, name, icon (public/icons/<icon>.svg), depth (min crafts from base, unlimited copies), pop (dataset popularity), custom",
        "elements": [{k: e[k] for k in ("id", "name", "icon", "depth", "pop", "custom")} for e in elements],
    })
    rec_list = sorted([a, b, c] for (a, b), c in recipes.items())
    write_json(os.path.join(DATA, "recipes.json"), {
        "version": 1,
        "count": len(rec_list),
        "format": "[a, b, result] element ids, a <= b; unordered pair -> exactly one result",
        "recipes": rec_list,
    }, compact=True)
    log(f"wrote {len(elements)} elements, {len(rec_list)} recipes")

    # ---- puzzles ---------------------------------------------------------------------------
    review_path = os.path.join(DATA, "recipe_review.json")
    keep = set(load_json(review_path).get("keep", [])) if os.path.exists(review_path) else set()
    nm = lambda i: elements[i]["name"]
    approved = {k for k, c in recipes.items() if recipe_key(nm(k[0]), nm(k[1]), nm(c)) in keep}
    log(f"review: {len(approved)} approved recipes for winning paths")
    gen = Generator(elements, recipes, nbr, args.seed, approved)
    start = dt.date.fromisoformat(args.start)
    used_targets, used_boards, puzzles = {}, set(), []
    unreviewed_days = 0
    for day in range(args.days):
        date = start + dt.timedelta(days=day)
        par, n_tok = WEEKDAY_PLAN[date.weekday()]
        other = PAR_MAX if par == PAR_MIN else PAR_MIN
        made = None
        # fallbacks so no day is skipped
        attempts = [(par, n_tok, TARGET_COOLDOWN_DAYS), (par, MIN_TOKENS + MAX_TOKENS - n_tok, TARGET_COOLDOWN_DAYS),
                    (other, MAX_TOKENS, TARGET_COOLDOWN_DAYS), (par, n_tok, 30), (par, MAX_TOKENS, 0),
                    (other, MAX_TOKENS, 0)]
        # reviewed recipes only first, then anything as a last resort
        for strict in (True, False):
            for p, nt, cd in attempts:
                made = gen.make(p, nt, used_targets, used_boards, day, cd, strict=strict)
                if made:
                    break
            if made:
                unreviewed_days += not strict
                break
        if not made:
            log(f"!! could not generate puzzle for {date}")
            continue
        target, tokens, distractors, sol = made
        used_targets[target] = day
        used_boards.add(tuple(sorted(tokens)) + (target,))
        name = lambda i: elements[i]["name"]
        puzzles.append({
            "number": len(puzzles) + 1,
            "date": date.isoformat(),
            "weekday": date.strftime("%a"),
            "target": target,
            "target_name": name(target),
            "par": sol["par"],
            "difficulty": None,
            "tokens": tokens,
            "token_names": [name(t) for t in tokens],
            "optimal_path": sol["path"],
            "optimal_path_text": [f"{name(x)} + {name(y)} = {name(c)}" for x, y, c in sol["path"]],
            "optimal_routes": sol["ways_by_merges"].get(sol["par"], 0),
            "routes_by_merges": sol["ways_by_merges"],
            "distractors": sorted(distractors),
            "distinct_paths": sol["distinct_paths"],
            "possible_reactions": len(sol["reactions"]),
            "_complexity_raw": complexity_raw(sol["par"], len(tokens), sol),
        })
        if (day + 1) % 50 == 0:
            log(f"  {day + 1} puzzles... ({time.time() - t0:.0f}s)")

    # ---- verification ------------------------------------------------------------------
    solver = gen.solver
    bfs_confirmed = bfs_skipped = 0
    for pz in puzzles:
        assert PAR_MIN <= pz["par"] <= PAR_MAX
        assert MIN_TOKENS <= len(pz["tokens"]) <= MAX_TOKENS
        assert pz["target"] not in pz["tokens"]
        assert len(solver.distinct_trees(pz["tokens"], pz["target"])) >= MIN_PATHS, pz["number"]
        assert solver.replay(pz["tokens"], pz["optimal_path"], pz["target"]) == pz["par"]
        r = solver.bfs_min_merges(pz["tokens"], pz["target"], pz["par"])
        if r == -1:
            bfs_skipped += 1
        else:
            assert r == pz["par"], (pz["number"], r, pz["par"])
            bfs_confirmed += 1
    log(f"review: {unreviewed_days} puzzles needed unreviewed recipes (run scripts/review_recipes.py)")
    log(f"verified {len(puzzles)} puzzles: replay OK for all; independent multiset BFS confirmed par "
        f"on {bfs_confirmed} (state cap hit on {bfs_skipped}, covered by exact lattice solver)")

    assign_difficulty(puzzles)
    # complexity = 0-1 percentile of the raw score
    raws = sorted(p["_complexity_raw"] for p in puzzles)
    for pz in puzzles:
        r = pz.pop("_complexity_raw")
        pz["complexity"] = round(sum(x <= r for x in raws) / len(raws), 3)

    write_json(os.path.join(DATA, "daily_puzzles.json"), {
        "version": 1,
        "start_date": args.start,
        "count": len(puzzles),
        "seed": args.seed,
        "rules": "Each token is one consumable copy; merging x+y consumes both and spawns recipe(x,y). "
                 "par = minimum merges to produce target from these exact tokens.",
        "puzzles": puzzles,
    })
    pars = collections.Counter(p["par"] for p in puzzles)
    diffs = collections.Counter(p["difficulty"] for p in puzzles)
    log(f"wrote {len(puzzles)} puzzles; par mix {dict(sorted(pars.items()))}; difficulty {dict(sorted(diffs.items()))}")
    for fn in ("elements.json", "recipes.json", "daily_puzzles.json"):
        log(f"  data/{fn}: {os.path.getsize(os.path.join(DATA, fn)) / 1024:.0f} KB")
    log(f"done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
