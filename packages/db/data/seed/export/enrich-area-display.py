"""Stamp display groups onto area_type.csv.gz and strip level suffixes from area.csv.gz.

The Pholio source carries neither: which types roll into which user-facing level is a
service-side decision, and Pholio area names embed their level ("London region
(statistical)") where the service stores the bare name and lets the level carry that
context. Run after export-seed.py / transform-uuids.py, before committing the CSVs.
"""

import csv
import gzip
import io
import re
import sys

DISPLAY_GROUPS = {
    "County unchanged": ("Local authorities", 1),
    "LA unchanged": ("Local authorities", 1),
    "UA unchanged": ("Local authorities", 1),
    "UA new 2020": ("Local authorities", 1),
    "UA new 2021": ("Local authorities", 1),
    "UA new 2023": ("Local authorities", 1),
    "Regions (statistical)": ("Statistical regions", 2),
    "NHS regions": ("NHS regions", 3),
    "ICBs": ("Integrated care boards", 4),
    "MSOA": ("Middle-layer super output areas", 5),
    "GPs": ("GP practices", 6),
}


def strip_name(name: str) -> str:
    name = re.sub(r" region \(statistical\)$", "", name)
    name = re.sub(r" NHS Region$", "", name)
    name = re.sub(r"^NHS (.+) Integrated Care Board - \w+$", r"\1", name)
    name = re.sub(r" UA$", "", name)
    return name


def enrich_area_types(path: str) -> None:
    with gzip.open(path, "rt") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        group, order = DISPLAY_GROUPS.get(row["name"], ("", ""))
        row["display_group"], row["display_order"] = group, order
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf, fieldnames=["id", "name", "hierarchy_type", "level", "display_group", "display_order"]
    )
    writer.writeheader()
    writer.writerows(rows)
    with gzip.open(path, "wt", newline="") as f:
        f.write(buf.getvalue())
    print(f"{path}: {sum(1 for r in rows if r['display_group'])} of {len(rows)} types grouped")


def strip_area_names(path: str) -> None:
    with gzip.open(path, "rt") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    name_index = header.index("name")
    changed = 0
    for row in rows:
        stripped = strip_name(row[name_index])
        if stripped != row[name_index]:
            row[name_index] = stripped
            changed += 1
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    with gzip.open(path, "wt", newline="") as f:
        f.write(buf.getvalue())
    print(f"{path}: {changed} of {len(rows)} names stripped")


if __name__ == "__main__":
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    enrich_area_types(f"{directory}/area_type.csv.gz")
    strip_area_names(f"{directory}/area.csv.gz")
