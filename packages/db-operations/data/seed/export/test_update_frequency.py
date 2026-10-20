"""Checks for the update frequency translation the exports apply."""

import runpy
import unittest
from pathlib import Path

from update_frequency import UPDATE_FREQUENCIES, update_frequency_value

transform = runpy.run_path(str(Path(__file__).with_name("transform-uuids.py")))


class UpdateFrequencyValueTest(unittest.TestCase):
    def test_gives_each_fingertips_frequency_a_service_value(self):
        self.assertEqual(
            {name: update_frequency_value(name) for name in UPDATE_FREQUENCIES},
            {
                "Annual": "annually",
                "Monthly (not yet in use)": "monthly",
                "Quarterly (not yet in use)": "quarterly",
            },
        )

    def test_refuses_a_frequency_it_has_no_value_for(self):
        with self.assertRaises(ValueError) as raised:
            update_frequency_value("Fortnightly")

        self.assertIn("Fortnightly", str(raised.exception))


class PublishedTablesTest(unittest.TestCase):
    def test_exports_no_frequency_table(self):
        self.assertNotIn("frequency", transform["PUBLISHED_TABLES"])
        self.assertNotIn("frequency_id", transform["FOREIGN_KEYS"]["indicator_version"])


if __name__ == "__main__":
    unittest.main()
