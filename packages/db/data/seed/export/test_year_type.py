"""Checks for the year type translation the exports apply."""

import runpy
import unittest
from pathlib import Path

from year_type import PERIOD_TYPE_IDS, YEAR_TYPE_IDS, YEAR_TYPES, year_type_select, year_type_values

transform = runpy.run_path(str(Path(__file__).with_name("transform-uuids.py")))
reshape = runpy.run_path(str(Path(__file__).with_name("reshape-indicator-versions.py")))
MIGRATION = Path(__file__).parents[3] / "drizzle" / "0025_period-type.sql"
UTILS = Path(__file__).parents[4] / "utils" / "src" / "period-type.ts"


class YearTypeValuesTest(unittest.TestCase):
    def test_gives_every_fingertips_year_type_a_service_value(self):
        self.assertEqual(len(YEAR_TYPES), 17)
        for name in YEAR_TYPES:
            values = year_type_values(name)
            self.assertIn(values["period_type_id"], PERIOD_TYPE_IDS.values())
            self.assertIn(values["year_type_id"], YEAR_TYPE_IDS.values())

    def test_keeps_the_three_in_use_in_the_seed_as_years(self):
        for name, year_type in [
            ("Calendar", "calendar"),
            ("Financial", "financial"),
            ("Academic", "academic"),
        ]:
            self.assertEqual(
                year_type_values(name),
                {
                    "period_type_id": PERIOD_TYPE_IDS["years"],
                    "year_type_id": YEAR_TYPE_IDS[year_type],
                    "year_end_day": None,
                    "year_end_month": None,
                },
            )

    def test_gives_a_month_range_the_date_its_year_ends(self):
        self.assertEqual(
            year_type_values("August-July"),
            {
                "period_type_id": PERIOD_TYPE_IDS["years"],
                "year_type_id": YEAR_TYPE_IDS["specified-end-date"],
                "year_end_day": 31,
                "year_end_month": 7,
            },
        )

    def test_gives_a_date_only_to_a_year_ending_on_one(self):
        for name, (_, year_type, year_end) in YEAR_TYPES.items():
            self.assertEqual(year_end is not None, year_type == "specified-end-date", name)

    def test_counts_cumulative_quarters_as_financial_quarters(self):
        values = year_type_values("Financial multi year cumulative quarters")

        self.assertEqual(values["period_type_id"], PERIOD_TYPE_IDS["quarters"])
        self.assertEqual(values["year_type_id"], YEAR_TYPE_IDS["financial"])

    def test_refuses_a_year_type_it_has_no_value_for(self):
        with self.assertRaises(ValueError) as raised:
            year_type_values("Fortnightly")

        self.assertIn("Fortnightly", str(raised.exception))

    def test_selects_all_four_columns(self):
        select = year_type_select("i.year_type_id")

        for column in ["period_type_id", "year_type_id", "year_end_day", "year_end_month"]:
            self.assertIn(f" END AS {column}", select)
        self.assertIn("WHEN 'August-July' THEN 31", select)


class SameTranslationTest(unittest.TestCase):
    def test_uses_the_ids_the_app_knows(self):
        source = UTILS.read_text()
        for id in [*PERIOD_TYPE_IDS.values(), *YEAR_TYPE_IDS.values()]:
            self.assertIn(f"'{id}'", source)

    def test_translates_as_the_migration_does(self):
        migration = MIGRATION.read_text()
        for name, values in ((name, year_type_values(name)) for name in YEAR_TYPES):
            day = values["year_end_day"]
            month = values["year_end_month"]
            self.assertRegex(
                migration,
                rf"\('{name}', '{values['period_type_id']}'(::uuid)?, "
                rf"'{values['year_type_id']}'(::uuid)?, "
                rf"{'NULL' if day is None else day}(::smallint)?, "
                rf"{'NULL' if month is None else month}(::smallint)?\)",
            )


class ExportsTest(unittest.TestCase):
    def test_exports_no_year_type_table(self):
        self.assertNotIn("year_type", transform["PUBLISHED_TABLES"])
        self.assertNotIn("year_type_id", transform["FOREIGN_KEYS"]["indicator_version"])

    def test_keeps_the_tags_that_fix_published_ids(self):
        self.assertEqual(transform["TABLE_TAGS"]["ci_method"], 4)

    def test_writes_the_four_columns_on_each_version(self):
        for column in ["period_type_id", "year_type_id", "year_end_day", "year_end_month"]:
            self.assertIn(column, reshape["VERSION_COLUMNS"])


if __name__ == "__main__":
    unittest.main()
