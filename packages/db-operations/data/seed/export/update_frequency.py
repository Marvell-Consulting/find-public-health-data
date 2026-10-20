"""The service's update frequency for each Fingertips frequency name.

The service stores how often an indicator is updated as one of the values in
UPDATE_FREQUENCIES in @fphd/utils/update-frequency; the exports translate Pholio's
lookup rows to them.
"""

UPDATE_FREQUENCIES = {
    "Annual": "annually",
    "Monthly (not yet in use)": "monthly",
    "Quarterly (not yet in use)": "quarterly",
}


def update_frequency_value(name):
    """The value for a Fingertips frequency name; a name with none stops the export."""
    try:
        return UPDATE_FREQUENCIES[name]
    except KeyError:
        raise ValueError(f"No update frequency value for the Fingertips frequency {name!r}") from None
