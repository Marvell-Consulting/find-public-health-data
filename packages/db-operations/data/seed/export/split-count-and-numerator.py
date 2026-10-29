#!/usr/bin/env python3
"""Give observation.csv.gz the service's numerator column, moving each count that is one.

Run locally after reshape-indicator-versions.py:

    python3 split-count-and-numerator.py ..

Each observation's count moves to numerator when its indicator's value type is calculated from a
numerator and a denominator, and the indicator is not one whose count is an estimate, as
count_and_numerator.py decides. A file that already has a
numerator column stops the script rather than move its counts twice.
"""

import csv
import gzip
import os
import sys

from count_and_numerator import split_count


def main(seed_dir):
    with gzip.open(os.path.join(seed_dir, "indicator.csv.gz"), "rt", newline="") as f:
        fingertips_ids = {row["id"]: row["short_id"] for row in csv.DictReader(f)}
    with gzip.open(os.path.join(seed_dir, "indicator_version.csv.gz"), "rt", newline="") as f:
        value_types = {row["indicator_id"]: row["value_type_id"] for row in csv.DictReader(f)}

    path = os.path.join(seed_dir, "observation.csv.gz")
    tmp = f"{path}.tmp"
    with gzip.open(path, "rt", newline="") as source, gzip.open(tmp, "wt", newline="") as target:
        reader = csv.DictReader(source)
        columns = list(reader.fieldnames or [])
        if "numerator" in columns:
            raise ValueError(f"{path} already has a numerator column")
        columns.insert(columns.index("count") + 1, "numerator")
        writer = csv.DictWriter(target, fieldnames=columns)
        writer.writeheader()
        for row in reader:
            if row["indicator_id"] not in value_types:
                raise ValueError(f"Observation {row['id']} belongs to no exported indicator version")
            indicator_id = row["indicator_id"]
            writer.writerow(
                split_count(row, value_types[indicator_id], fingertips_ids[indicator_id])
            )
    os.replace(tmp, path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
