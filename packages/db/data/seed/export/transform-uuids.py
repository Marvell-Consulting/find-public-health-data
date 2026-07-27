#!/usr/bin/env python3
"""Convert the integer-keyed CSVs produced by export-seed.py to UUIDv7 keys.

Run locally after downloading the export:

    python3 transform-uuids.py ..

Each table's rows get sequential UUIDv7 ids following source-id order (so v7
time-ordering mirrors the original insert order), every foreign-key column is
remapped, and the indicator table keeps its public Fingertips number in a new
fingertips_id column.
"""

import csv
import gzip
import os
import secrets
import sys
import time

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


def main(seed_dir):
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

    for table in TABLES:
        path = os.path.join(seed_dir, f"{table}.csv.gz")
        tmp = f"{path}.tmp"
        fks = FOREIGN_KEYS.get(table, {})
        own = id_maps[table]
        with gzip.open(path, "rt", newline="") as src, gzip.open(tmp, "wt", newline="") as dst:
            reader, writer = csv.reader(src), csv.writer(dst)
            header = next(reader)
            id_index = header.index("id")
            fk_indexes = {header.index(col): id_maps[ref] for col, ref in fks.items()}
            if table == "indicator":
                writer.writerow([*header[: id_index + 1], "fingertips_id", *header[id_index + 1 :]])
            else:
                writer.writerow(header)
            rows = 0
            for row in reader:
                old_id = row[id_index]
                row[id_index] = own[old_id]
                for i, ref_map in fk_indexes.items():
                    if row[i] != "":
                        row[i] = ref_map[row[i]]
                if table == "indicator":
                    row = [*row[: id_index + 1], old_id, *row[id_index + 1 :]]
                writer.writerow(row)
                rows += 1
        os.replace(tmp, path)
        print(f"{table}: {rows} rows rekeyed")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "..")
