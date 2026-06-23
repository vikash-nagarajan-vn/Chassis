"""Forgiving, typo-tolerant entry search, implemented in Python.

Replaces the JavaScript Fuse.js dependency. A robotics log gets written fast and
messy, so a search for "gearbx" should still surface "Gearbox slipping". We use
difflib for fuzzy token matching, plus plain substring matching for exact hits.
A team's board is small (hundreds of entries), so this is plenty fast.
"""

import re
from difflib import SequenceMatcher


def _tokens(text):
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _best_token_ratio(q, tokens):
    best = 0.0
    for t in tokens:
        if q in t or t in q:
            return 1.0
        r = SequenceMatcher(None, q, t).ratio()
        if r > best:
            best = r
    return best


def search_entries(entries, tag_map, query):
    q = (query or "").strip().lower()
    if not q:
        return entries

    q_tokens = _tokens(q)
    scored = []
    for e in entries:
        tag_names = " ".join(tag_map[t]["name"] for t in e.get("tag_ids", []) if t in tag_map)
        haystack = f"{e['title']} {e['description']} {tag_names} {e.get('author', '')}".lower()
        hay_tokens = _tokens(haystack)

        if q in haystack:  # fast path: exact phrase present
            scored.append((1.0, e))
            continue

        # Every query token must find a close enough match somewhere.
        ratios = [_best_token_ratio(qt, hay_tokens) for qt in q_tokens]
        if ratios and min(ratios) >= 0.72:
            scored.append((sum(ratios) / len(ratios), e))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [e for _, e in scored]
