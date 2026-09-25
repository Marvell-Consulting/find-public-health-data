"""Fingertips' numerator and denominator sources, which the seed keeps as Pholio shaped them.

The service has neither the numerator_denominator_source table nor the version columns that
name its rows: the seed load maps each name onto the core data providers through
../../legacy-numerator-denominator-sources.json. A script that writes the seed CSVs therefore
reads the legacy ids from the seed itself, and stops at a name the map does not cover.
"""

import csv
import gzip
import json
from pathlib import Path

LEGACY_COLUMNS = ("numerator_source_id", "denominator_source_id")

LEGACY_MAP_PATH = Path(__file__).resolve().parents[2] / "legacy-numerator-denominator-sources.json"


def read_legacy_map(path=LEGACY_MAP_PATH):
    with open(path, encoding="utf-8") as source:
        return json.load(source)


def legacy_source_ids(seed_dir):
    """Each legacy source's id by its name, as the load matches it: trimmed."""
    with gzip.open(Path(seed_dir) / "numerator_denominator_source.csv.gz", "rt", newline="") as source:
        return {row["name"].strip(): row["id"] for row in csv.DictReader(source)}


def version_legacy_sources(seed_dir):
    """Each seeded version's legacy source ids, which the database no longer holds."""
    with gzip.open(Path(seed_dir) / "indicator_version.csv.gz", "rt", newline="") as source:
        return {
            row["id"]: tuple(row[column] or None for column in LEGACY_COLUMNS)
            for row in csv.DictReader(source)
        }


def legacy_source(name, ids, legacy_map):
    """The id of the legacy source a Fingertips name gives, and the pairs it maps to."""
    if not name:
        return None, []
    key = name.strip()
    if key not in ids:
        raise ValueError(f"No numerator_denominator_source row named {key!r} in the seed")
    if key not in legacy_map:
        raise ValueError(
            f"No mapping for the source {key!r}: add it to legacy-numerator-denominator-sources.json"
        )
    return ids[key], legacy_map[key]
