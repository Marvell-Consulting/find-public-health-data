#!/usr/bin/env python3
"""Stream the published Pholio benchmark clone into seed-format CSV files.

Run as the local Postgres user on the benchmark VM. The source database is the
PHOLIO_LIVE_A-derived `fphd_new`, never PHOLIO_STAGING. Each approved source
indicator is exported as an identity row plus one published indicator_version
row, less the indicators in EXCLUDED_INDICATORS and their data. Before anything
is written the approved names are checked against the slug rule, so two
indicators that would share a public address stop the export here rather than
the import. Output still has source integer keys; transform-uuids.py
--deterministic converts them without an ID map.
"""

import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from notes_and_caveats import notes_and_caveats_select
from polarity import POLARITIES
from published_csv import NULL_MARKER
from slug import assign_slugs
from update_frequency import UPDATE_FREQUENCIES

TABLES = [
    "value_type",
    "unit",
    "year_type",
    "ci_method",
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

# Approved indicators left out of the archive, with their data. Each is the retired half of
# a pair that shares a name, and so would share a slug, with a newer indicator; the newer
# one is kept. The importer holds the same list, so an archive built with a different one
# is refused.
EXCLUDED_INDICATORS = {
    90366: "Life expectancy at birth (superseded by 93283)",
    90776: "Chlamydia detection rate per 100,000 aged 15 to 24 years (superseded by 91514)",
    92774: "Percentage of adults who abstain from drinking alcohol (superseded by 94182)",
    93280: "Fuel poverty (low income, low energy efficiency methodology) (superseded by 93759)",
}
EXCLUDED_ID_LIST = "(" + ", ".join(str(id) for id in sorted(EXCLUDED_INDICATORS)) + ")"


def psql(query):
    return subprocess.run(
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DATABASE, "-Atc", query],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def sql_string(value):
    return "'" + value.replace("'", "''") + "'"


# The service's polarity value in place of the reference to Pholio's lookup row.
POLARITY_VALUE = (
    "CASE (SELECT name FROM polarity WHERE id = i.polarity_id) "
    + " ".join(
        f"WHEN {sql_string(name)} THEN {sql_string(value)}" for name, value in POLARITIES.items()
    )
    + " END"
)

# The service's update frequency in place of the reference to Pholio's lookup row.
UPDATE_FREQUENCY_VALUE = (
    "CASE (SELECT name FROM frequency WHERE id = i.frequency_id) "
    + " ".join(
        f"WHEN {sql_string(name)} THEN {sql_string(value)}"
        for name, value in UPDATE_FREQUENCIES.items()
    )
    + " END"
)

EXPORTED_INDICATORS = f"SELECT id FROM indicator WHERE id NOT IN {EXCLUDED_ID_LIST}"
EXPORTED_OBSERVATIONS = f"SELECT id FROM observation WHERE indicator_id IN ({EXPORTED_INDICATORS})"

SELECTS = {
    "indicator": (
        "SELECT id, data_updated_at, created_at FROM indicator "
        f"WHERE id NOT IN {EXCLUDED_ID_LIST}"
    ),
    # The version takes both the editable indicator columns and the whole of
    # indicator_metadata; its id is rekeyed from the same source id under its own tag.
    "indicator_version": (
        "SELECT i.id AS id, i.id AS indicator_id, 'published' AS status, "
        "i.updated_at AS published_at, i.name, i.value_type_id, i.unit_id, "
        f"i.year_type_id, i.ci_method_id, {POLARITY_VALUE} AS polarity, "
        f"{UPDATE_FREQUENCY_VALUE} AS update_frequency, "
        "i.comparator_method_id, i.disclosure_threshold, i.ci_confidence_level, "
        "i.config, m.definition, m.rationale, m.methodology, m.numerator_definition, "
        f"m.denominator_definition, {notes_and_caveats_select('m')}, "
        "m.data_source_id, m.numerator_source_id, m.denominator_source_id, "
        "i.created_at, i.updated_at, i.created_by, i.updated_by "
        "FROM indicator i LEFT JOIN indicator_metadata m ON m.indicator_id = i.id "
        f"WHERE i.id NOT IN {EXCLUDED_ID_LIST}"
    ),
    "upload_batch": f"SELECT * FROM upload_batch WHERE indicator_id IN ({EXPORTED_INDICATORS})",
    "observation": f"SELECT * FROM observation WHERE indicator_id IN ({EXPORTED_INDICATORS})",
    "observation_dimension": (
        "SELECT od.id, od.observation_id, od.dimension_value_id, dv.dimension_type_id "
        "FROM observation_dimension od "
        "JOIN dimension_value dv ON dv.id = od.dimension_value_id "
        f"WHERE od.observation_id IN ({EXPORTED_OBSERVATIONS})"
    ),
    "observation_note": (
        f"SELECT * FROM observation_note WHERE observation_id IN ({EXPORTED_OBSERVATIONS})"
    ),
}


def select_query(table):
    return SELECTS.get(table, f"SELECT * FROM {table}")


def copy_query(table):
    return (
        f"COPY ({select_query(table)}) TO STDOUT "
        f"WITH (FORMAT csv, HEADER true, NULL '{NULL_MARKER}')"
    )


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
    # Counted from the same query the file came from, so an exclusion is reflected here.
    rows = int(psql(f"SELECT count(*) FROM ({select_query(table)}) AS exported"))
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    print(f"{table}: {rows:,} rows, {path.stat().st_size:,} compressed bytes", flush=True)
    return {"rows": rows, "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def check_exclusions_are_approved():
    """Every excluded id must name an approved indicator, or the exclusion is a stale note."""
    present = {
        int(id)
        for id in psql(
            f"SELECT id FROM indicator WHERE status = 'approved' AND id IN {EXCLUDED_ID_LIST}"
        ).split()
    }
    missing = sorted(set(EXCLUDED_INDICATORS) - present)
    if missing:
        raise RuntimeError(
            "EXCLUDED_INDICATORS names indicators the source does not hold as approved: "
            + ", ".join(str(id) for id in missing)
        )


def check_slugs():
    """Fail before any data is written if two exported names would share a slug."""
    # Whitespace runs become one hyphen in a slug, so flattening a multi-line name here
    # keeps psql's one-row-per-line output parseable without changing the result.
    rows = psql(
        "SELECT id, regexp_replace(name, '\\s+', ' ', 'g') FROM indicator "
        f"WHERE id NOT IN {EXCLUDED_ID_LIST}"
    )
    lines = (line.partition("|") for line in rows.split("\n") if line)
    assign_slugs((id, id, name) for id, _, name in lines)


def check_polarities():
    """Fail before any data is written if an exported polarity has no service value."""
    names = psql(
        "SELECT DISTINCT p.name FROM indicator i JOIN polarity p ON p.id = i.polarity_id "
        f"WHERE i.id NOT IN {EXCLUDED_ID_LIST}"
    )
    unknown = sorted(name for name in names.split("\n") if name and name not in POLARITIES)
    if unknown:
        raise RuntimeError("No polarity value for: " + ", ".join(unknown))


def check_update_frequencies():
    """Fail before any data is written if an exported frequency has no service value."""
    names = psql(
        "SELECT DISTINCT f.name FROM indicator i JOIN frequency f ON f.id = i.frequency_id "
        f"WHERE i.id NOT IN {EXCLUDED_ID_LIST}"
    )
    unknown = sorted(
        name for name in names.split("\n") if name and name not in UPDATE_FREQUENCIES
    )
    if unknown:
        raise RuntimeError("No update frequency value for: " + ", ".join(unknown))


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
    excluded_observations = int(
        psql(f"SELECT count(*) FROM observation WHERE indicator_id IN {EXCLUDED_ID_LIST}")
    )
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
    check_exclusions_are_approved()
    check_slugs()
    check_polarities()
    check_update_frequencies()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    tables = {table: export_table(table, args.out_dir) for table in args.tables}
    manifest = {
        "source": "PHOLIO_LIVE_A-derived fphd_new benchmark clone",
        "source_database": database,
        "approved_indicators": int(approved),
        "source_observations": observations,
        "excluded_indicators": sorted(EXCLUDED_INDICATORS),
        # What the exclusions took with them, so the importer can require the rest exactly.
        "excluded_observations": excluded_observations,
        "source_csv_null": NULL_MARKER,
        "tables": tables,
    }
    (args.out_dir / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
