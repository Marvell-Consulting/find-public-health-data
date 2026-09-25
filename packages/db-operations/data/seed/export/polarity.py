"""The service's polarity value for each Fingertips polarity name.

The service stores a polarity as one of the values in POLARITIES in
@fphd/utils/polarity; the exports translate Pholio's lookup rows to them.
"""

POLARITIES = {
    "RAG - High is good": "higher-is-better",
    "RAG - Low is good": "lower-is-better",
    "BOB - Blue orange blue": "no-polarity",
    "Not applicable": "no-comparison-possible",
}


def polarity_value(name):
    """The value for a Fingertips polarity name; a name with none stops the export."""
    try:
        return POLARITIES[name]
    except KeyError:
        raise ValueError(f"No polarity value for the Fingertips polarity {name!r}") from None
