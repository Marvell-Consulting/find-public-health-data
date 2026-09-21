"""The indicator slug rule, mirroring @fphd/config/slug.

The seed arrives by COPY, so the CSV has to carry the slug the app would have
derived. A TypeScript test reads the committed CSV and checks every slug against
the TypeScript rule, so the two cannot drift apart unnoticed.
"""

import re
import unicodedata

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SLUG_MAX_LENGTH = 80
RESERVED_SLUGS = ("compare", "facets", "search")


def slugify(name):
    """Lower case, accents folded, whitespace hyphenated, cut on a word boundary."""
    decomposed = unicodedata.normalize("NFKD", name)
    unmarked = "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))
    hyphenated = re.sub(r"\s+", "-", unmarked.lower())
    cleaned = re.sub(r"[^a-z0-9-]+", "", hyphenated)
    slug = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return slug if len(slug) <= SLUG_MAX_LENGTH else cut_to_word_boundary(slug)


def cut_to_word_boundary(slug):
    overlong = slug[: SLUG_MAX_LENGTH + 1]
    boundary = overlong.rfind("-")
    # A first word longer than the limit has no boundary to cut on, so it is cut short.
    cut = overlong[:SLUG_MAX_LENGTH] if boundary == -1 else overlong[:boundary]
    return cut.rstrip("-")


def slug_problem(name):
    """Why a name yields no usable slug: 'empty', 'digits', 'reserved', or None."""
    slug = slugify(name)
    if not slug:
        return "empty"
    if slug.isdigit():
        return "digits"
    if slug in RESERVED_SLUGS:
        return "reserved"
    return None


def assign_slugs(indicators):
    """Map each indicator id to its slug.

    `indicators` is an iterable of (indicator_id, short_id, name). A name that
    yields no usable slug stops the export, named. Where two indicators slugify
    alike the lower short id keeps the bare slug and the rest take `-<short id>`.
    """
    entries = sorted(
        (int(short_id), str(indicator_id), name) for indicator_id, short_id, name in indicators
    )
    for short_id, indicator_id, name in entries:
        problem = slug_problem(name)
        if problem:
            raise ValueError(
                f"indicator {short_id} ({indicator_id}) has a name with no usable slug "
                f"({problem}): {name!r}"
            )

    slugs = {}
    claimed = set()
    for short_id, indicator_id, name in entries:
        base = slugify(name)
        slugs[indicator_id] = base if base not in claimed else f"{base}-{short_id}"
        claimed.add(base)

    if len(set(slugs.values())) != len(slugs):
        raise ValueError("Two indicators were given the same slug")

    return slugs
