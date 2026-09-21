#!/usr/bin/env python3
"""Stream the published Pholio benchmark clone into seed-format CSV files.

Run as the local Postgres user on the benchmark VM. The source database is the
PHOLIO_LIVE_A-derived `fphd_new`, never PHOLIO_STAGING. Each approved source
indicator is exported as an identity row plus one published indicator_version
row. Output still has source integer keys; transform-uuids.py --deterministic
converts them without an ID map.
"""

import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from published_csv import NULL_MARKER

TABLES = [
    "value_type",
    "unit",
    "year_type",
    "ci_method",
    "polarity",
    "frequency",
    "comparator_method",
    "data_source",
    "numerator_denominator_source",
    "dimension_type",
    "dimension_value",
    "area_type",
    "area",
    "area_relationship",
    "indicator",
    "indicator_version",
    "upload_batch",
    "note_type",
    "observation",
    "observation_dimension",
    "observation_note",
]

DATABASE = "fphd_new"
EXPECTED_INDICATORS = 1290
EXPECTED_OBSERVATIONS = 29380899


def psql(query):
    return subprocess.run(
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DATABASE, "-Atc", query],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


SELECTS = {
    "indicator": "SELECT id, data_updated_at, created_at FROM indicator",
    # The version takes both the editable indicator columns and the whole of
    # indicator_metadata; its id is rekeyed from the same source id under its own tag.
    "indicator_version": (
        "SELECT i.id AS id, i.id AS indicator_id, 'published' AS status, "
        "i.updated_at AS published_at, i.name, i.value_type_id, i.unit_id, "
        "i.year_type_id, i.ci_method_id, i.polarity_id, i.frequency_id, "
        "i.comparator_method_id, i.disclosure_threshold, i.ci_confidence_level, "
        "i.config, m.definition, m.rationale, m.methodology, m.numerator_definition, "
        "m.denominator_definition, m.disclosure_control, m.caveats, m.notes, "
        "m.data_source_id, m.numerator_source_id, m.denominator_source_id, "
        "i.created_at, i.updated_at, i.created_by, i.updated_by "
        "FROM indicator i LEFT JOIN indicator_metadata m ON m.indicator_id = i.id"
    ),
    "observation_dimension": (
        "SELECT od.id, od.observation_id, od.dimension_value_id, dv.dimension_type_id "
        "FROM observation_dimension od "
        "JOIN dimension_value dv ON dv.id = od.dimension_value_id"
    ),
}

# Derived tables count their rows against the table they are built from.
COUNTED_AS = {"indicator_version": "indicator"}


def copy_query(table):
    select = SELECTS.get(table, f"SELECT * FROM {table}")
    return f"COPY ({select}) TO STDOUT WITH (FORMAT csv, HEADER true, NULL '{NULL_MARKER}')"


def export_table(table, out_dir):
    path = out_dir / f"{table}.csv.gz"
    process = subprocess.Popen(
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DATABASE, "-c", copy_query(table)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    with gzip.open(path, "wb", compresslevel=1) as output:
        shutil.copyfileobj(process.stdout, output, length=1024 * 1024)
    error = process.stderr.read().decode()
    if process.wait() != 0:
        path.unlink(missing_ok=True)
        raise RuntimeError(f"Exporting {table} failed: {error}")
    rows = int(psql(f"SELECT count(*) FROM {COUNTED_AS.get(table, table)}"))
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    print(f"{table}: {rows:,} rows, {path.stat().st_size:,} compressed bytes", flush=True)
    return {"rows": rows, "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--tables", nargs="+", choices=TABLES, default=TABLES)
    args = parser.parse_args()

    database, approved, other, unattributed = psql(
        "SELECT current_database(), count(*) FILTER (WHERE status = 'approved'), "
        "count(*) FILTER (WHERE status IS DISTINCT FROM 'approved'), "
        "count(*) FILTER (WHERE created_by IS NULL OR updated_by IS NULL) FROM indicator"
    ).split("|")
    observations = int(psql("SELECT count(*) FROM observation"))
    if (
        database != DATABASE
        or int(approved) != EXPECTED_INDICATORS
        or int(other) != 0
        or observations != EXPECTED_OBSERVATIONS
    ):
        raise RuntimeError("Source must be the approved-only published benchmark clone")
    # indicator_version.created_by and updated_by are NOT NULL, so a gap here would only
    # surface as a failed COPY after the whole 29-million-row archive had been built.
    if int(unattributed) != 0:
        raise RuntimeError("Source indicators must all record who created and updated them")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    tables = {table: export_table(table, args.out_dir) for table in args.tables}
    manifest = {
        "source": "PHOLIO_LIVE_A-derived fphd_new benchmark clone",
        "source_database": database,
        "approved_indicators": int(approved),
        "source_csv_null": NULL_MARKER,
        "tables": tables,
    }
    (args.out_dir / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
