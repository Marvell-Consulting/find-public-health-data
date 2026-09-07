"""Strip Pholio's HTML out of indicator_metadata.csv.gz prose columns.

The pages used to run this conversion on every render; the database now stores the
display-ready text instead. A port of the web apps' plainTextFromHtml: block-level
closers and <br> become newlines, other tags are dropped in one left-to-right pass, and
entities decode afterwards so a decoded "&lt;" is never mistaken for markup. Run after
export-seed.py, before committing the CSVs.
"""

import csv
import gzip
import io
import re
import sys

NAMED_ENTITIES = {
    "amp": "&",
    "apos": "'",
    "bull": "•",
    "gt": ">",
    "hellip": "…",
    "ldquo": "\u201c",
    "lsquo": "\u2018",
    "lt": "<",
    "mdash": "—",
    "micro": "µ",
    "nbsp": " ",
    "ndash": "–",
    "pound": "£",
    "quot": '"',
    "rdquo": "\u201d",
    "rsquo": "\u2019",
}

BLOCK_BREAK_TAGS = {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}

PROSE_COLUMNS = [
    "definition",
    "rationale",
    "methodology",
    "numerator_definition",
    "denominator_definition",
    "disclosure_control",
    "caveats",
    "notes",
]


def from_code_point(value, match):
    if 0 <= value <= 0x10FFFF:
        try:
            return chr(value)
        except ValueError:
            return match
    return match


def decode_entities(text):
    def replace(match):
        code = match.group(1)
        lowered = code.lower()
        if lowered.startswith("#x"):
            return from_code_point(int(code[2:], 16), match.group(0))
        if code.startswith("#"):
            return from_code_point(int(code[1:], 10), match.group(0))
        return NAMED_ENTITIES.get(lowered, match.group(0))

    return re.sub(r"&(#x[0-9a-f]+|#[0-9]+|[a-z]+);", replace, text, flags=re.I)


def plain_text_from_html(text):
    stripped = []
    index = 0
    while index < len(text):
        open_at = text.find("<", index)
        if open_at == -1:
            stripped.append(text[index:])
            break
        stripped.append(text[index:open_at])
        body = open_at + 2 if text.startswith("</", open_at) else open_at + 1
        next_char = text[body : body + 1]
        if not re.match(r"[a-z!]", next_char, re.I):
            stripped.append("<")
            index = open_at + 1
            continue
        close = text.find(">", body)
        if close == -1:
            break
        is_closer = text[open_at + 1 : open_at + 2] == "/"
        name_match = re.match(r"[a-z0-9]+", text[body:close], re.I)
        name = name_match.group(0).lower() if name_match else ""
        if name == "br" or (is_closer and name in BLOCK_BREAK_TAGS):
            stripped.append("\n")
        index = close + 1
    result = decode_entities("".join(stripped))
    result = re.sub(r"[ \t]+\n", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def strip_file(path):
    with gzip.open(path, "rt") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
    changed = 0
    for row in rows:
        for column in PROSE_COLUMNS:
            value = row.get(column) or ""
            stripped = plain_text_from_html(value) if value else value
            if stripped != value:
                row[column] = stripped
                changed += 1
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    with gzip.open(path, "wt", newline="") as f:
        f.write(buf.getvalue())
    print(f"{path}: {changed} values stripped across {len(rows)} rows")


if __name__ == "__main__":
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    strip_file(f"{directory}/indicator_metadata.csv.gz")
