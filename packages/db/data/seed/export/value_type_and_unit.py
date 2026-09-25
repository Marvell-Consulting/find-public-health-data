"""The service's value type and unit for each Fingertips value type and unit name.

The service holds them as references to the value_type and unit rows whose ids are in
@fphd/utils/value-type-and-unit, with the unit's own name in unit_other when it is not one
of the service's; the exports translate Pholio's lookup rows to them. Migration 0026 holds
the same translation for databases that already had the Fingertips rows.
"""

VALUE_TYPE_IDS = {
    "Count": "01a0d8a5-3ca2-7315-bfca-96c7324d4347",
    "Crude rate": "01a0d8a5-3ca2-7315-bfca-96c8c77cad18",
    "Directly standardised rate": "01a0d8a5-3ca2-7315-bfca-96c9664c846c",
    "Excess risk": "01a0d8a5-3ca2-7315-bfca-96ca4c9608e9",
    "Gap": "01a0d8a5-3ca2-7315-bfca-96cb03846bff",
    "Indirectly standardised proportion": "01a0d8a5-3ca2-7315-bfca-96cc2dc711c3",
    "Indirectly standardised ratio": "01a0d8a5-3ca2-7315-bfca-96cda63ea940",
    "Life expectancy": "01a0d8a5-3ca2-7315-bfca-96ce5ffc8d47",
    "Mean": "01a0d8a5-3ca2-7315-bfca-96cff286704d",
    "Median": "01a0d8a5-3ca2-7315-bfca-96d0928fd186",
    "Percentage point": "01a0d8a5-3ca2-7315-bfca-96d1b508d83f",
    "Proportion": "01a0d8a5-3ca2-7315-bfca-96d2031a65e7",
    "Ratio": "01a0d8a5-3ca2-7315-bfca-96d34a17c74b",
    "Score": "01a0d8a5-3ca2-7315-bfca-96d4cc7f7bcb",
    "Slope index of inequality": "01a0d8a5-3ca2-7315-bfca-96d54168d21f",
}

UNIT_IDS = {
    "%": "01a0d8a5-3ca2-7315-bfca-96d615820bd4",
    "per 100": "01a0d8a5-3ca2-7315-bfca-96d787920e40",
    "per 1,000": "01a0d8a5-3ca2-7315-bfca-96d8d8d7aec2",
    "per 10,000": "01a0d8a5-3ca2-7315-bfca-96d97b88dbff",
    "per 100,000": "01a0d8a5-3ca2-7315-bfca-96daa0c93ee9",
    "per 1,000,000": "01a0d8a5-3ca2-7315-bfca-96dbaf432da2",
    "minutes": "01a0d8a5-3ca2-7315-bfca-96dca2ab3487",
    "hours": "01a0d8a5-3ca2-7315-bfca-96dd9ae52dc5",
    "days": "01a0d8a5-3ca2-7315-bfca-96de5fe00871",
    "weeks": "01a0d8a5-3ca2-7315-bfca-96df3a570e5d",
    "months": "01a0d8a5-3ca2-7315-bfca-96e0128fd88d",
    "years": "01a0d8a5-3ca2-7315-bfca-96e1a3b040d3",
    "£": "01a0d8a5-3ca2-7315-bfca-96e2d3cf5df0",
    "£ per capita": "01a0d8a5-3ca2-7315-bfca-96e3aae4dc98",
    "No unit": "01a0d8a5-3ca2-7315-bfca-96e4a96bfc8e",
    "Other": "01a0d8a5-3ca2-7315-bfca-96e5cee57158",
}

# Fingertips value types with no service value, such as Months life lost, stop the export.
VALUE_TYPES = {
    **{name: name for name in VALUE_TYPE_IDS},
    "Slope Index of Inequality": "Slope index of inequality",
    "Number": "Count",
    "Rate ratio": "Ratio",
}

# Any other named Fingertips unit is an other unit; a placeholder has no name to keep.
UNITS = {
    "Percent": "%",
    "per 100": "per 100",
    "per 1,000": "per 1,000",
    "per 10,000": "per 10,000",
    "per 100,000": "per 100,000",
    "per 1,000,000": "per 1,000,000",
    "Minutes": "minutes",
    "Days": "days",
    "Years": "years",
    "£": "£",
    "£ per capita": "£ per capita",
    "No unit": "No unit",
}

# The Fingertips API gives a unit's label, not its name: each listed unit's name by its label.
# "£" is left out, as Pholio's "£ per 100,000" has that label too.
UNIT_NAMES_BY_LABEL = {
    "%": "Percent",
    "per 100": "per 100",
    "per 1,000": "per 1,000",
    "per 10,000": "per 10,000",
    "per 100,000": "per 100,000",
    "per 1,000,000": "per 1,000,000",
    "min": "Minutes",
    "Days": "Days",
    "Years": "Years",
    "£ per capita": "£ per capita",
    "No unit": "No unit",
}

UNKNOWN_UNIT_PREFIX = "Unknown unit "

UNIT_OTHER_MAX_LENGTH = 100

UNIT_COLUMNS = ["unit_id", "unit_other"]


def value_type_id(name):
    """The value type for a Fingertips value type name; a name with none stops the export."""
    try:
        return VALUE_TYPE_IDS[VALUE_TYPES[name]]
    except KeyError:
        raise ValueError(f"No value type for the Fingertips value type {name!r}") from None


def unit_values(name):
    """The unit columns' values for a Fingertips unit name; a placeholder stops the export."""
    if name in UNITS:
        return {"unit_id": UNIT_IDS[UNITS[name]], "unit_other": None}
    other = name.strip()
    if not other or other.startswith(UNKNOWN_UNIT_PREFIX) or len(other) > UNIT_OTHER_MAX_LENGTH:
        raise ValueError(f"No unit for the Fingertips unit {name!r}")
    return {"unit_id": UNIT_IDS["Other"], "unit_other": other}


def unit_name_for_label(label):
    """The Fingertips unit name for a Fingertips API unit label; any other label stops the import."""
    try:
        return UNIT_NAMES_BY_LABEL[label]
    except KeyError:
        raise ValueError(f"No Fingertips unit name known for the unit label {label!r}") from None


def _sql_literal(value):
    return "NULL" if value is None else "'" + value.replace("'", "''") + "'"


def value_type_select(value_type_id_expression):
    """The translation as a SELECT column, from an expression holding Pholio's value type id."""
    name = f"(SELECT name FROM value_type WHERE id = {value_type_id_expression})"
    cases = " ".join(
        f"WHEN {_sql_literal(source)} THEN {_sql_literal(value_type_id(source))}"
        for source in VALUE_TYPES
    )
    return f"CASE {name} {cases} END AS value_type_id"


def unit_select(unit_id_expression):
    """The translation as SELECT columns, from an expression holding Pholio's unit id."""
    name = f"(SELECT name FROM unit WHERE id = {unit_id_expression})"
    known = {source: unit_values(source)["unit_id"] for source in UNITS}
    cases = " ".join(
        f"WHEN {_sql_literal(source)} THEN {_sql_literal(unit)}" for source, unit in known.items()
    )
    other = _sql_literal(UNIT_IDS["Other"])
    return (
        f"CASE {name} {cases} ELSE {other} END AS unit_id, "
        f"CASE WHEN {name} IN ({', '.join(_sql_literal(source) for source in UNITS)}) THEN NULL "
        f"ELSE btrim({name}) END AS unit_other"
    )


def unknown_value_types(names):
    """The names among these the translation has no value type for."""
    return sorted(name for name in names if name and name not in VALUE_TYPES)


def unknown_units(names):
    """The names among these the translation has no unit for."""
    unknown = []
    for name in filter(None, names):
        try:
            unit_values(name)
        except ValueError:
            unknown.append(name)
    return sorted(unknown)
