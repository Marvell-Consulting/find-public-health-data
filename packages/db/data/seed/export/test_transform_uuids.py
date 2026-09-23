"""Regression checks for the published CSV's NULL encoding."""

import csv
import gzip
import io
import json
import runpy
import tempfile
import unittest
from pathlib import Path


transform = runpy.run_path(str(Path(__file__).with_name("transform-uuids.py")))
strip_metadata = runpy.run_path(str(Path(__file__).with_name("strip-metadata-html.py")))
enrich_area = runpy.run_path(str(Path(__file__).with_name("enrich-area-display.py")))


class PublishedCsvTest(unittest.TestCase):
    def test_writes_null_and_empty_string_differently(self):
        output = io.StringIO()
        transform["write_published_row"](
            output,
            [transform["NULL_MARKER"], "", 'a,"b"', "line\nbreak"],
            final=True,
        )

        self.assertEqual(output.getvalue(), ',"","a,""b""","line\nbreak"\r\n')

    def test_preserves_null_indicator_config(self):
        self.assertEqual(
            transform["normalize_published_config"](transform["NULL_MARKER"]),
            transform["NULL_MARKER"],
        )

    def test_metadata_cleanup_preserves_empty_string_and_null(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "source-manifest.json").write_text(
                json.dumps({"source_csv_null": transform["NULL_MARKER"]})
            )
            path = Path(directory, "indicator_version.csv.gz")
            with gzip.open(path, "wt", newline="") as output:
                output.write(
                    'id,definition,caveats\r\n'
                    f'1,{transform["NULL_MARKER"]},""\r\n'
                )

            strip_metadata["strip_file"](str(path))

            with gzip.open(path, "rt", newline="") as result:
                text = result.read()
            self.assertIn(
                f'"1",{transform["NULL_MARKER"]},""\r\n', text
            )
            row = next(csv.reader(io.StringIO(text.split("\r\n", 1)[1])))
            final = io.StringIO()
            transform["write_published_row"](final, row, final=True)
            self.assertEqual(final.getvalue(), '"1",,""\r\n')

    def test_area_enrichment_keeps_unmapped_group_null(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "source-manifest.json").write_text(
                json.dumps({"source_csv_null": transform["NULL_MARKER"]})
            )
            path = Path(directory, "area_type.csv.gz")
            with gzip.open(path, "wt", newline="") as output:
                output.write("id,name,hierarchy_type,level\r\n1,Other,Administrative,1\r\n")

            enrich_area["enrich_area_types"](str(path))

            with gzip.open(path, "rt", newline="") as result:
                self.assertIn(
                    f'"1","Other","Administrative","1",{transform["NULL_MARKER"]},{transform["NULL_MARKER"]}\r\n',
                    result.read(),
                )

    def test_cleanup_and_deterministic_transform_preserve_both_values(self):
        with tempfile.TemporaryDirectory() as directory:
            tables = {table: {"rows": 1} for table in transform["PUBLISHED_TABLES"]}
            Path(directory, "source-manifest.json").write_text(
                json.dumps(
                    {
                        "source": "PHOLIO_LIVE_A-derived fphd_new benchmark clone",
                        "source_csv_null": transform["NULL_MARKER"],
                        "tables": tables,
                    }
                )
            )
            for table in transform["PUBLISHED_TABLES"]:
                foreign_keys = list(transform["FOREIGN_KEYS"].get(table, {}))
                if table == "indicator":
                    foreign_keys = []
                header = ["id", *foreign_keys]
                row = ["1", *(["1"] * len(foreign_keys))]
                if table == "indicator_version":
                    header.extend(["config", "definition", "caveats"])
                    row.extend([transform["NULL_MARKER"], transform["NULL_MARKER"], ""])
                with gzip.open(Path(directory, f"{table}.csv.gz"), "wt", newline="") as output:
                    csv.writer(output).writerow(header)
                    transform["write_published_row"](output, row)

            strip_metadata["strip_file"](str(Path(directory, "indicator_version.csv.gz")))
            transform["main"](directory, deterministic=True)

            with gzip.open(
                Path(directory, "indicator_version.csv.gz"), "rt", newline=""
            ) as result:
                self.assertTrue(result.read().endswith(',,""\r\n'))


class ForeignKeyIndexesTest(unittest.TestCase):
    def test_maps_each_foreign_key_column_to_its_table(self):
        self.assertEqual(
            transform["foreign_key_indexes"](
                "observation_note", ["id", "note_type_id", "observation_id"]
            ),
            {1: "note_type", 2: "observation"},
        )

    def test_allows_the_identity_only_indicator_row(self):
        self.assertEqual(transform["foreign_key_indexes"]("indicator", ["id", "created_at"]), {})

    def test_refuses_any_other_table_missing_a_foreign_key(self):
        with self.assertRaises(ValueError) as raised:
            transform["foreign_key_indexes"]("observation_note", ["id", "observation_id"])

        self.assertIn("note_type_id", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
