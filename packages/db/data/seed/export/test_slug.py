"""The slug rule the seed export applies, mirroring @fphd/config/slug."""

import unittest

from slug import SLUG_MAX_LENGTH, SLUG_PATTERN, assign_slugs, slug_problem, slugify


class SlugifyTest(unittest.TestCase):
    def test_derives_a_slug_from_a_name(self):
        cases = {
            "Under 75 mortality rate from all causes": "under-75-mortality-rate-from-all-causes",
            "Diabetes: QOF prevalence": "diabetes-qof-prevalence",
            "Under-75 mortality": "under-75-mortality",
            "% of people in each quintile": "of-people-in-each-quintile",
            "Emergency admissions (0–4 years)": "emergency-admissions-04-years",
            "Children's dental health": "childrens-dental-health",
            "  leading and trailing  ": "leading-and-trailing",
            "tabs\tand\nnewlines": "tabs-and-newlines",
            "--dashes--everywhere--": "dashes-everywhere",
        }
        for name, slug in cases.items():
            with self.subTest(name=name):
                self.assertEqual(slugify(name), slug)

    def test_folds_accents_to_plain_letters(self):
        self.assertEqual(slugify("Café résumé naïve"), "cafe-resume-naive")

    def test_yields_nothing_when_nothing_usable_is_left(self):
        self.assertEqual(slugify("!!! ???"), "")

    def test_cuts_on_a_word_boundary(self):
        slug = slugify("word " * 16 + "overrun")

        self.assertLessEqual(len(slug), SLUG_MAX_LENGTH)
        self.assertTrue(slug.endswith("-word"))
        self.assertNotIn("overrun", slug)

    def test_cuts_a_single_overlong_word_short(self):
        self.assertEqual(slugify("a" * 120), "a" * SLUG_MAX_LENGTH)

    def test_matches_the_shared_pattern(self):
        self.assertRegex(slugify("Mortality rate: deaths involving diabetes"), SLUG_PATTERN)


class SlugProblemTest(unittest.TestCase):
    def test_reports_nothing_for_a_usable_name(self):
        self.assertIsNone(slug_problem("Life expectancy at birth"))

    def test_reports_the_reason_a_name_is_unusable(self):
        self.assertEqual(slug_problem("!!!"), "empty")
        self.assertEqual(slug_problem("2024"), "digits")
        self.assertEqual(slug_problem("Search"), "reserved")


class AssignSlugsTest(unittest.TestCase):
    def test_gives_each_indicator_the_slug_of_its_name(self):
        slugs = assign_slugs(
            [("a", 108, "Under 75 mortality"), ("b", 241, "Diabetes: QOF prevalence")]
        )

        self.assertEqual(
            slugs, {"a": "under-75-mortality", "b": "diabetes-qof-prevalence"}
        )

    def test_lets_the_lower_short_id_keep_the_bare_slug(self):
        slugs = assign_slugs(
            [("b", 900, "Resident population"), ("a", 108, "Resident population")]
        )

        self.assertEqual(
            slugs, {"a": "resident-population", "b": "resident-population-900"}
        )

    def test_refuses_a_name_with_no_usable_slug(self):
        for name in ("!!!", "2024", "Search"):
            with self.subTest(name=name):
                with self.assertRaises(ValueError) as raised:
                    assign_slugs([("a", 108, name)])
                self.assertIn("108", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
