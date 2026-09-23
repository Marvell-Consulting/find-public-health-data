"""The indicator slug rule, mirroring @fphd/config/slug.

The seed arrives by COPY, so the CSV has to carry the slug the app would have
derived. A TypeScript test reads the committed CSV and checks every slug against
the TypeScript rule, so the two cannot drift apart unnoticed.
"""

import re
import unicodedata
from collections import defaultdict

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SLUG_MAX_LENGTH = 200
RESERVED_SLUGS = ("compare", "facets", "search")
# Unicode White_Space, dashes and slashes; not `\s`, which JavaScript reads differently.
WORD_SEPARATORS = re.compile(
    r"[\t\n\v\f\r \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u2010-\u2015/\\]+"
)


def slugify(name):
    """Lower case, accents folded, spaces, dashes and slashes hyphenated, cut on a word boundary."""
    decomposed = unicodedata.normalize("NFKD", name)
    unmarked = "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))
    # A dash or a slash separates words as a space does: "and/or", "0–4 years".
    hyphenated = WORD_SEPARATORS.sub("-", unmarked.lower())
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
    yields no usable slug, or two names that slugify alike, stop the export with
    the indicators named: a slug belongs to one indicator, so a collision is an
    editorial problem to settle in the source rather than one for a suffix to hide.
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

    holders = defaultdict(list)
    for short_id, indicator_id, name in entries:
        holders[slugify(name)].append((short_id, name))

    collisions = {slug: held for slug, held in holders.items() if len(held) > 1}
    if collisions:
        detail = "\n".join(
            f"  {slug}: " + ", ".join(f"{short_id} ({name!r})" for short_id, name in held)
            for slug, held in sorted(collisions.items())
        )
        raise ValueError(
            f"{len(collisions)} slug(s) would belong to more than one indicator; "
            f"rename or exclude one of each before exporting:\n{detail}"
        )

    return {indicator_id: slugify(name) for _, indicator_id, name in entries}
