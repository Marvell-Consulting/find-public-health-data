#!/usr/bin/env python3
"""Convert the integer-keyed CSVs produced by export-seed.py to UUIDv7 keys.

Run locally after downloading the export:

    python3 transform-uuids.py ..

The default mode assigns sequential UUIDv7 ids following source-id order.
`--deterministic` maps table and source ID directly to UUIDv7 so a full
published snapshot can be converted with bounded memory. Every foreign key is
remapped, and the indicator keeps its public Fingertips number as `short_id`.
"""

import argparse
import csv
import gzip
import hashlib
import json
import os
import secrets
import time
from pathlib import Path

from published_csv import NULL_MARKER, write_published_row

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
TABLE_TAGS = {table: index + 1 for index, table in enumerate(TABLES)}

FOREIGN_KEYS = {
    "dimension_value": {"dimension_type_id": "dimension_type", "parent_id": "dimension_value"},
    "area": {"area_type_id": "area_type"},
    "area_relationship": {"parent_area_id": "area", "child_area_id": "area"},
    "indicator": {
        "value_type_id": "value_type",
        "unit_id": "unit",
        "year_type_id": "year_type",
        "ci_method_id": "ci_method",
        "polarity_id": "polarity",
        "frequency_id": "frequency",
        "comparator_method_id": "comparator_method",
        "supersedes_id": "indicator",
    },
    "indicator_metadata": {
        "indicator_id": "indicator",
        "data_source_id": "data_source",
        "numerator_source_id": "numerator_denominator_source",
        "denominator_source_id": "numerator_denominator_source",
    },
    "upload_batch": {"indicator_id": "indicator", "superseded_by_id": "upload_batch"},
    "observation": {
        "indicator_id": "indicator",
        "area_id": "area",
        "upload_batch_id": "upload_batch",
    },
    "observation_dimension": {
        "observation_id": "observation",
        "dimension_value_id": "dimension_value",
        "dimension_type_id": "dimension_type",
    },
    "observation_note": {"observation_id": "observation", "note_type_id": "note_type"},
}


def uuid7(ts_ms):
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)
    value = (ts_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0x2 << 62) | rand_b
    hexed = f"{value:032x}"
    return f"{hexed[:8]}-{hexed[8:12]}-{hexed[12:16]}-{hexed[16:20]}-{hexed[20:]}"


def deterministic_uuid7(table, old_id):
    numeric_id = int(old_id)
    encoded_id = 2 * numeric_id if numeric_id >= 0 else -2 * numeric_id - 1
    if encoded_id >= 1 << 62:
        raise ValueError(f"{table} id is outside the supported range: {old_id}")
    table_tag = TABLE_TAGS[table]
    timestamp_ms = 1777593600000  # 2026-05-01, before the published benchmark snapshot.
    value = (timestamp_ms << 80) | (0x7 << 76) | (table_tag << 64) | (0x2 << 62) | encoded_id
    hexed = f"{value:032x}"
    return f"{hexed[:8]}-{hexed[8:12]}-{hexed[12:16]}-{hexed[16:20]}-{hexed[20:]}"


def normalize_published_config(value):
    """The benchmark clone stores some Pholio configs as JSON strings."""
    if not value or value == NULL_MARKER:
        return value
    parsed = json.loads(value)
    if not isinstance(parsed, str):
        return value
    config = {}
    for pair in parsed.split(","):
        key, _, raw = pair.partition(":")
        raw = raw.strip()
        config[key.strip()] = int(raw) if raw.lstrip("-").isdigit() else raw
    return json.dumps(config)


def main(seed_dir, deterministic=False):
    if deterministic:
        source_manifest = json.loads(Path(seed_dir, "source-manifest.json").read_text())
        if source_manifest["source"] != "PHOLIO_LIVE_A-derived fphd_new benchmark clone":
            raise ValueError("Deterministic transform requires the published benchmark export")
        if source_manifest.get("source_csv_null") != NULL_MARKER:
            raise ValueError("Published export must distinguish NULL from empty strings")
        if set(source_manifest["tables"]) != set(TABLES):
            raise ValueError("The published export is missing one or more tables")
        convert = deterministic_uuid7
    else:
        base_ms = int(time.time() * 1000)
        id_maps = {}
        for table in TABLES:
            path = os.path.join(seed_dir, f"{table}.csv.gz")
            with gzip.open(path, "rt", newline="") as f:
                reader = csv.reader(f)
                header = next(reader)
                id_index = header.index("id")
                old_ids = sorted((int(row[id_index]) for row in reader))
            id_maps[table] = {
                str(old): uuid7(base_ms + offset) for offset, old in enumerate(old_ids)
            }
            base_ms += len(old_ids)

        def convert(table, old_id):
            return id_maps[table][old_id]

    for table in TABLES:
        path = os.path.join(seed_dir, f"{table}.csv.gz")
        tmp = f"{path}.tmp"
        fks = FOREIGN_KEYS.get(table, {})
        with gzip.open(path, "rt", newline="") as src, gzip.open(tmp, "wt", newline="") as dst:
            reader, writer = csv.reader(src), csv.writer(dst)
            header = next(reader)
            id_index = header.index("id")
            config_index = header.index("config") if deterministic and table == "indicator" else None
            fk_indexes = {header.index(col): ref for col, ref in fks.items()}
            if table == "indicator":
                writer.writerow([*header[: id_index + 1], "short_id", *header[id_index + 1 :]])
            else:
                writer.writerow(header)
            rows = 0
            for row in reader:
                old_id = row[id_index]
                row[id_index] = convert(table, old_id)
                for i, ref_table in fk_indexes.items():
                    if row[i] not in ("", NULL_MARKER):
                        row[i] = convert(ref_table, row[i])
                if table == "indicator":
                    if config_index is not None:
                        row[config_index] = normalize_published_config(row[config_index])
                    row = [*row[: id_index + 1], old_id, *row[id_index + 1 :]]
                if deterministic:
                    write_published_row(dst, row, final=True)
                else:
                    writer.writerow(row)
                rows += 1
        os.replace(tmp, path)
        print(f"{table}: {rows} rows rekeyed")

    if deterministic:
        manifest = {**source_manifest, "id_mapping": "deterministic-uuidv7-v1"}
        for table in TABLES:
            path = Path(seed_dir, f"{table}.csv.gz")
            digest = hashlib.sha256()
            with path.open("rb") as file:
                while chunk := file.read(1024 * 1024):
                    digest.update(chunk)
            source = source_manifest["tables"][table]
            manifest["tables"][table] = {
                "rows": source["rows"],
                "bytes": path.stat().st_size,
                "sha256": digest.hexdigest(),
            }
        manifest_path = Path(seed_dir, "manifest.json")
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("seed_dir", nargs="?", default="..")
    parser.add_argument("--deterministic", action="store_true")
    args = parser.parse_args()
    main(args.seed_dir, deterministic=args.deterministic)
