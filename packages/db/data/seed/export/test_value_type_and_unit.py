"""Checks for the value type and unit translation the exports apply."""

import json
import re
import runpy
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path

from value_type_and_unit import (
    UNIT_COLUMNS,
    UNIT_IDS,
    UNIT_NAMES_BY_LABEL,
    UNITS,
    VALUE_TYPE_IDS,
    VALUE_TYPES,
    unit_name_for_label,
    unit_select,
    unit_values,
    unknown_units,
    unknown_value_types,
    value_type_id,
)

transform = runpy.run_path(str(Path(__file__).with_name("transform-uuids.py")))
reshape = runpy.run_path(str(Path(__file__).with_name("reshape-indicator-versions.py")))
snapshot = runpy.run_path(str(Path(__file__).with_name("export-published-snapshot.py")))
(migration,) = Path(__file__).parents[3].glob("drizzle/*_value-type-and-units.sql")


class ValueTypeIdTest(unittest.TestCase):
    def test_keeps_each_service_value_type(self):
        for name, id in VALUE_TYPE_IDS.items():
            self.assertEqual(value_type_id(name), id)

    def test_gives_renamed_and_merged_value_types_a_service_value(self):
        self.assertEqual(
            value_type_id("Slope Index of Inequality"),
            VALUE_TYPE_IDS["Slope index of inequality"],
        )
        self.assertEqual(value_type_id("Number"), VALUE_TYPE_IDS["Count"])
        self.assertEqual(value_type_id("Rate ratio"), VALUE_TYPE_IDS["Ratio"])

    def test_refuses_a_value_type_it_has_no_value_for(self):
        for name in ["Months life lost", "Relative Index of Inequality", "Unknown value type 21"]:
            with self.assertRaises(ValueError) as raised:
                value_type_id(name)

            self.assertIn(name, str(raised.exception))


class UnitValuesTest(unittest.TestCase):
    def test_gives_each_fingertips_unit_in_the_list_its_row(self):
        self.assertEqual(
            {
                name: unit_values(name)["unit_id"]
                for name in ["Percent", "per 100,000", "Minutes", "Days", "Years", "No unit"]
            },
            {
                "Percent": UNIT_IDS["%"],
                "per 100,000": UNIT_IDS["per 100,000"],
                "Minutes": UNIT_IDS["minutes"],
                "Days": UNIT_IDS["days"],
                "Years": UNIT_IDS["years"],
                "No unit": UNIT_IDS["No unit"],
            },
        )
        self.assertIsNone(unit_values("Percent")["unit_other"])

    def test_names_any_other_unit_as_fingertips_named_it(self):
        self.assertEqual(
            unit_values("per 1,000, per day "),
            {"unit_id": UNIT_IDS["Other"], "unit_other": "per 1,000, per day"},
        )
        self.assertEqual(
            unit_values("Percentage points"),
            {"unit_id": UNIT_IDS["Other"], "unit_other": "Percentage points"},
        )

    def test_refuses_a_placeholder_or_a_name_too_long_to_keep(self):
        for name in ["Unknown unit 54", " ", "x" * 101]:
            with self.assertRaises(ValueError):
                unit_values(name)


class UnitNameForLabelTest(unittest.TestCase):
    def test_gives_the_name_the_migration_and_exports_translate(self):
        self.assertEqual(unit_name_for_label("%"), "Percent")
        self.assertEqual(unit_name_for_label("min"), "Minutes")
        self.assertEqual(unit_name_for_label("per 100,000"), "per 100,000")
        self.assertEqual(unit_values(unit_name_for_label("min"))["unit_id"], UNIT_IDS["minutes"])

    def test_names_only_listed_units(self):
        self.assertLessEqual(set(UNIT_NAMES_BY_LABEL.values()), set(UNITS))

    def test_refuses_a_label_it_cannot_name(self):
        # "£" is also the label of "£ per 100,000"; "per 1,000/day" names "per 1,000, per day ".
        for label in ["£", "per 1,000/day", "kg/m2", "Unknown"]:
            with self.assertRaises(ValueError) as raised:
                unit_name_for_label(label)

            self.assertIn(label, str(raised.exception))


class UnknownNamesTest(unittest.TestCase):
    def test_lists_the_names_it_cannot_translate(self):
        self.assertEqual(
            unknown_value_types(["Count", "Months life lost", ""]), ["", "Months life lost"]
        )
        self.assertEqual(
            unknown_units(["Percent", "Kg/m2", "Unknown unit 54", "", "  "]),
            ["", "  ", "Unknown unit 54"],
        )


def selected_unit(name):
    """unit_select's columns for a Pholio unit with this name, or for no unit when it is None."""
    with closing(sqlite3.connect(":memory:")) as db:
        # Postgres's btrim with one argument trims spaces.
        db.create_function("btrim", 1, lambda value: None if value is None else value.strip(" "))
        db.execute("CREATE TABLE unit (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        if name is not None:
            db.execute("INSERT INTO unit VALUES (1, ?)", [name])
        row = db.execute(f"SELECT {unit_select(':unit_id')}", {"unit_id": 1}).fetchone()
    return dict(zip(UNIT_COLUMNS, row))


class UnitSelectTest(unittest.TestCase):
    def test_leaves_no_unit_unanswered(self):
        self.assertEqual(selected_unit(None), {"unit_id": None, "unit_other": None})

    def test_agrees_with_unit_values(self):
        for name in ["Percent", "No unit", "per 1,000 live births", "per 1,000, per day "]:
            with self.subTest(name=name):
                self.assertEqual(selected_unit(name), unit_values(name))

    def test_leaves_a_blank_or_placeholder_name_to_the_check_before_it(self):
        for name in ["", "  ", "Unknown unit 54"]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    unit_values(name)
                self.assertEqual(unknown_units([name]), [name])


class CheckValueTypesAndUnitsTest(unittest.TestCase):
    def check(self, value_types, units):
        check = snapshot["check_value_types_and_units"]
        check.__globals__["psql"] = lambda query: json.dumps(
            units if "JOIN unit" in query else value_types
        )
        check()

    def test_passes_names_it_can_translate(self):
        self.check(["Count", "Number"], ["Percent", "per 1,000 live births"])

    def test_refuses_a_blank_unit_name(self):
        for name in ["", " "]:
            with self.subTest(name=name):
                with self.assertRaises(RuntimeError) as raised:
                    self.check(["Count"], ["Percent", name])

                self.assertIn(f"unit {name!r}", str(raised.exception))


def migration_translation(column):
    """The Fingertips names and ids in the migration's translation of this column."""
    (statement,) = [
        statement
        for statement in migration.read_text().split("--> statement-breakpoint")
        if f'SET "{column}" = m.{column}' in statement
    ]
    return dict(re.findall(r"\('((?:[^']|'')*)', '([0-9a-f-]{36})'", statement))


class MigrationTest(unittest.TestCase):
    def test_holds_the_same_value_type_translation(self):
        self.assertEqual(
            migration_translation("value_type_id"),
            {name: value_type_id(name) for name in VALUE_TYPES},
        )

    def test_holds_the_same_unit_translation(self):
        self.assertEqual(
            migration_translation("unit_id"),
            {name: unit_values(name)["unit_id"] for name in UNITS},
        )


class ReshapeTest(unittest.TestCase):
    def test_translates_a_pholio_row_to_the_version_columns(self):
        self.assertEqual(
            reshape["translated_value_type_and_unit"](
                {"value_type_id": "v", "unit_id": "u"},
                {"v": "Directly standardised rate"},
                {"u": "per 1,000 live births"},
            ),
            {
                "value_type_id": VALUE_TYPE_IDS["Directly standardised rate"],
                "unit_id": UNIT_IDS["Other"],
                "unit_other": "per 1,000 live births",
            },
        )


class PublishedTablesTest(unittest.TestCase):
    def test_exports_no_value_type_or_unit_table(self):
        for table in ["value_type", "unit"]:
            self.assertNotIn(table, transform["PUBLISHED_TABLES"])
            self.assertNotIn(f"{table}_id", transform["FOREIGN_KEYS"]["indicator_version"])


if __name__ == "__main__":
    unittest.main()
