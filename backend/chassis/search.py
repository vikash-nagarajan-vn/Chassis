"""Fuzzy search over board entries using only the standard library.

We lean on difflib.SequenceMatcher for typo tolerance. The goal is that a
sloppy query like 'gearbx' still surfaces 'Gearbox slipping under load'. We do
this without any external dependency so the backend stays light and deploys
cleanly on Render's free tier.
"""

from difflib import SequenceMatcher

# A query token must score at least this well against some haystack token to
# count as a match. 0.72 was chosen by hand: it forgives a dropped or swapped
# letter ('gearbx' vs 'gearbox') without matching unrelated words.
MATCH_THRESHOLD = 0.72


def _tokenize(text):
    """Lowercase and split text into alphanumeric word tokens.

    We strip punctuation by keeping only alphanumeric runs so a search for
    'pid' matches 'PID,' and 'PID.' alike. Returning a list (not a set) keeps
    the code simple downstream; duplicates do not hurt the scoring.
    """
    if not text:
        return []
    cleaned = []
    word = []
    for char in text.lower():
        if char.isalnum():
            word.append(char)
        elif word:
            cleaned.append("".join(word))
            word = []
    if word:
        cleaned.append("".join(word))
    return cleaned


def _best_token_score(query_token, haystack_tokens):
    """Return the best similarity of one query token against the haystack.

    An exact substring hit short-circuits to a perfect 1.0 so that typing a
    real word always wins over fuzzy near-misses. Otherwise we take the highest
    SequenceMatcher ratio across all haystack tokens.
    """
    best = 0.0
    for token in haystack_tokens:
        # Substring match is the strongest signal. 'gear' inside 'gearbox'
        # should rank as a certain hit, not a partial one.
        if query_token in token:
            return 1.0
        ratio = SequenceMatcher(None, query_token, token).ratio()
        if ratio > best:
            best = ratio
    return best


def _entry_haystack(entry, tag_map):
    """Collect all searchable text for an entry into one token list.

    Title, description, author, status, and the names of the entry's tags are
    all fair game. Pulling tag names in means a search for 'drivetrain' finds
    entries tagged Drivetrain even when the word never appears in the body.
    """
    parts = [
        entry.get("title", ""),
        entry.get("description", ""),
        entry.get("author", ""),
        entry.get("status", ""),
    ]
    for tag_id in entry.get("tag_ids", []):
        tag = tag_map.get(tag_id)
        if tag:
            parts.append(tag.get("name", ""))

    tokens = []
    for part in parts:
        tokens.extend(_tokenize(part))
    return tokens


def search_entries(entries, tag_map, query):
    """Return entries matching the query, ranked best first.

    Scoring: every query token finds its best score in the entry. An entry
    qualifies only if each query token clears MATCH_THRESHOLD somewhere (an
    AND across tokens), which keeps multi-word queries precise. The entry score
    is the average of those per-token bests, so a closer overall match ranks
    higher. An empty query returns the entries unchanged.
    """
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return list(entries)

    query_tokens = _tokenize(cleaned_query)
    if not query_tokens:
        return list(entries)

    scored = []
    for entry in entries:
        haystack = _entry_haystack(entry, tag_map)
        if not haystack:
            continue

        token_scores = []
        qualifies = True
        for q_token in query_tokens:
            score = _best_token_score(q_token, haystack)
            if score < MATCH_THRESHOLD:
                # One unmatched token disqualifies the whole entry. This is
                # what keeps 'arm pid' from matching an entry about arms only.
                qualifies = False
                break
            token_scores.append(score)

        if qualifies and token_scores:
            average = sum(token_scores) / len(token_scores)
            scored.append((average, entry))

    # Highest score first. Python's sort is stable, so entries with equal
    # scores keep their original (caller-provided) order.
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [entry for _, entry in scored]
