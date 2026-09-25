"""Stamp the derived slug onto an exported indicator_version.csv.gz.

The published snapshot emits the identity and version split straight from the
source, so it has no reshape step to derive slugs in. Run this after
strip-metadata-html.py and before transform-uuids.py, while the CSV still uses
the export's explicit NULL marker:

    python3 add-version-slugs.py /tmp/published-out

A name that yields no usable slug stops the run with the offending row named.
"""

import csv
import gzip
import io
import os
import sys
from pathlib import Path

from published_csv import published_null_marker, write_published_row
from slug import assign_slugs


def read_rows(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader), list(reader.fieldnames or [])


def short_ids(directory):
    rows, fields = read_rows(Path(directory, "indicator.csv.gz"))
    # Before the UUID transform the row id is the source's public number, which that
    # step moves into short_id; either way this reads the number the slug rule needs.
    column = "short_id" if "short_id" in fields else "id"
    return {row["id"]: row[column] for row in rows}


def add_slugs(directory):
    path = Path(directory, "indicator_version.csv.gz")
    rows, fields = read_rows(path)
    if "slug" in fields:
        raise ValueError(f"{path} already carries a slug column")

    numbers = short_ids(directory)
    slugs = assign_slugs(
        (row["indicator_id"], numbers[row["indicator_id"]], row["name"]) for row in rows
    )
    for row in rows:
        row["slug"] = slugs[row["indicator_id"]]
    fields.insert(fields.index("name") + 1, "slug")

    null_marker = published_null_marker(directory)
    buffer = io.StringIO()
    if null_marker:
        csv.writer(buffer).writerow(fields)
        for row in rows:
            write_published_row(buffer, [row[field] for field in fields])
    else:
        writer = csv.DictWriter(buffer, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    tmp = f"{path}.tmp"
    with gzip.open(tmp, "wt", encoding="utf-8", newline="") as f:
        f.write(buffer.getvalue())
    os.replace(tmp, path)
    print(f"{path}: {len(rows)} versions slugged")


if __name__ == "__main__":
    add_slugs(sys.argv[1] if len(sys.argv) > 1 else ".")
