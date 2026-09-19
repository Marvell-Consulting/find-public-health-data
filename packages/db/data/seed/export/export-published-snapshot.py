#!/usr/bin/env python3
"""Stream the published Pholio benchmark clone into seed-format CSV files.

Run as the local Postgres user on the benchmark VM. The source database is the
PHOLIO_LIVE_A-derived `fphd_new`, never PHOLIO_STAGING. Output still has source
integer keys; transform-uuids.py --deterministic converts them without an ID map.
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
    "indicator_metadata",
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


def copy_query(table):
    if table == "observation_dimension":
        return (
            "COPY (SELECT od.id, od.observation_id, od.dimension_value_id, "
            "dv.dimension_type_id FROM observation_dimension od "
            "JOIN dimension_value dv ON dv.id = od.dimension_value_id) "
            f"TO STDOUT WITH (FORMAT csv, HEADER true, NULL '{NULL_MARKER}')"
        )
    return f"COPY {table} TO STDOUT WITH (FORMAT csv, HEADER true, NULL '{NULL_MARKER}')"


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
    rows = int(psql(f"SELECT count(*) FROM {table}"))
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

    database, approved, other = psql(
        "SELECT current_database(), count(*) FILTER (WHERE status = 'approved'), "
        "count(*) FILTER (WHERE status IS DISTINCT FROM 'approved') FROM indicator"
    ).split("|")
    observations = int(psql("SELECT count(*) FROM observation"))
    if (
        database != DATABASE
        or int(approved) != EXPECTED_INDICATORS
        or int(other) != 0
        or observations != EXPECTED_OBSERVATIONS
    ):
        raise RuntimeError("Source must be the approved-only published benchmark clone")

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
