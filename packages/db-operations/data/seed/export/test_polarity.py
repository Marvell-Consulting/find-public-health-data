"""Checks for the polarity translation the exports apply."""

import runpy
import unittest
from pathlib import Path

from polarity import POLARITIES, polarity_value

transform = runpy.run_path(str(Path(__file__).with_name("transform-uuids.py")))


class PolarityValueTest(unittest.TestCase):
    def test_gives_each_fingertips_polarity_a_service_value(self):
        self.assertEqual(
            {name: polarity_value(name) for name in POLARITIES},
            {
                "RAG - High is good": "higher-is-better",
                "RAG - Low is good": "lower-is-better",
                "BOB - Blue orange blue": "no-polarity",
                "Not applicable": "no-comparison-possible",
            },
        )

    def test_refuses_a_polarity_it_has_no_value_for(self):
        with self.assertRaises(ValueError) as raised:
            polarity_value("RAG - Middle is good")

        self.assertIn("RAG - Middle is good", str(raised.exception))


class PublishedTablesTest(unittest.TestCase):
    def test_exports_no_polarity_table(self):
        self.assertNotIn("polarity", transform["PUBLISHED_TABLES"])
        self.assertNotIn("polarity_id", transform["FOREIGN_KEYS"]["indicator_version"])

    def test_keeps_the_tags_that_fix_published_ids(self):
        self.assertEqual(transform["TABLE_TAGS"]["frequency"], 6)
        self.assertEqual(transform["TABLE_TAGS"]["indicator"], 15)
        self.assertEqual(transform["TABLE_TAGS"]["indicator_version"], 16)


if __name__ == "__main__":
    unittest.main()
