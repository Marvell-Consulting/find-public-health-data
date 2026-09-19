"""Keep database NULL distinct from an empty string while rewriting published CSVs."""

import json
from pathlib import Path


NULL_MARKER = "__FPHD_NULL_5f92c66de4b849b4a717c23f5cbdb8a1__"


def published_null_marker(directory):
    path = Path(directory, "source-manifest.json")
    if not path.exists():
        return None
    marker = json.loads(path.read_text()).get("source_csv_null")
    if marker != NULL_MARKER:
        raise ValueError("Published export uses an unknown CSV NULL encoding")
    return marker


def write_published_row(output, row, *, final=False):
    output.write(
        ",".join(
            ("" if final else NULL_MARKER)
            if value == NULL_MARKER
            else '"' + str(value).replace('"', '""') + '"'
            for value in row
        )
        + "\r\n"
    )
