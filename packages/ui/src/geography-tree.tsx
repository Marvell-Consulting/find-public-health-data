import { useId, useState } from 'react';

export interface GeographyGroup {
  /** The area type this group offers, e.g. 'Regions (statistical)'. */
  name: string;
  areas: { code: string; name: string }[];
}

interface GeographyTreeProps {
  groups: GeographyGroup[];
  /** Field name for each area checkbox, so the tree works inside a plain form. */
  name: string;
  onChange: (selected: string[]) => void;
  selected: string[];
}

/**
 * The prototype's expandable geography picker: each area type collapses to a single row,
 * its checkbox selecting or clearing every area beneath it. A search narrows the visible
 * areas without changing what is selected, so filtering can never silently drop a choice.
 */
export function GeographyTree({ groups, name, onChange, selected }: GeographyTreeProps) {
  const searchId = useId();
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>(() => {
    // A group holding a selection starts open, so a restored selection is visible. With
    // only one group there is nothing to choose between, so it opens too rather than
    // hiding every area behind a toggle.
    const withSelection = groups
      .filter(({ areas }) => areas.some(({ code }) => selected.includes(code)))
      .map(({ name: groupName }) => groupName);

    return withSelection.length > 0 || groups.length > 1
      ? withSelection
      : groups.map(({ name: groupName }) => groupName);
  });

  const matches = ({ name: areaName, code }: { name: string; code: string }) =>
    query.trim() === '' ||
    areaName.toLowerCase().includes(query.trim().toLowerCase()) ||
    code.toLowerCase() === query.trim().toLowerCase();

  const toggleArea = (code: string, checked: boolean) => {
    onChange(checked ? [...selected, code] : selected.filter((value) => value !== code));
  };

  const toggleGroup = (group: GeographyGroup, checked: boolean) => {
    const codes = group.areas.map((area) => area.code);
    onChange(
      checked
        ? [...selected, ...codes.filter((code) => !selected.includes(code))]
        : selected.filter((code) => !codes.includes(code)),
    );
  };

  return (
    <div className="fphd-geo">
      <div className="govuk-form-group">
        <label className="govuk-label govuk-!-font-weight-bold" htmlFor={searchId}>
          Search for an area
        </label>
        <input
          className="govuk-input fphd-geo-search"
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div className="fphd-geo__tree">
        {groups.map((group) => {
          const visible = group.areas.filter(matches);
          const chosen = group.areas.filter(({ code }) => selected.includes(code));
          const isOpen =
            expanded.includes(group.name) || (query.trim() !== '' && visible.length > 0);
          const groupId = `${idPrefix}-${group.name.replace(/\W+/g, '-')}`;

          if (visible.length === 0) {
            return null;
          }

          return (
            <div className="fphd-geo__group" key={group.name}>
              <div className="fphd-geo__group-row">
                <button
                  aria-controls={groupId}
                  aria-expanded={isOpen}
                  className={`fphd-geo__toggle${isOpen ? ' fphd-geo__toggle--open' : ''}`}
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(group.name)
                        ? current.filter((value) => value !== group.name)
                        : [...current, group.name],
                    )
                  }
                  type="button"
                >
                  <span className="govuk-visually-hidden">
                    {isOpen ? 'Collapse' : 'Expand'} {group.name}
                  </span>
                  <span aria-hidden="true" className="fphd-geo__chevron" />
                </button>
                <div className="govuk-checkboxes govuk-checkboxes--small">
                  <div className="govuk-checkboxes__item">
                    <input
                      checked={chosen.length === group.areas.length && group.areas.length > 0}
                      className="govuk-checkboxes__input"
                      id={`${groupId}-all`}
                      onChange={(event) => toggleGroup(group, event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <label
                      className="govuk-label govuk-checkboxes__label"
                      htmlFor={`${groupId}-all`}
                    >
                      {group.name}
                      {chosen.length > 0 ? ` (${chosen.length} selected)` : ''}
                    </label>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <div className="fphd-geo__children" id={groupId}>
                  <div className="govuk-checkboxes govuk-checkboxes--small">
                    {visible.map((area) => (
                      <div className="govuk-checkboxes__item" key={area.code}>
                        <input
                          checked={selected.includes(area.code)}
                          className="govuk-checkboxes__input"
                          id={`${groupId}-${area.code}`}
                          name={name}
                          onChange={(event) => toggleArea(area.code, event.currentTarget.checked)}
                          type="checkbox"
                          value={area.code}
                        />
                        <label
                          className="govuk-label govuk-checkboxes__label"
                          htmlFor={`${groupId}-${area.code}`}
                        >
                          {area.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Selections in a collapsed group must still submit with the form.
                chosen.map((area) => (
                  <input key={area.code} name={name} type="hidden" value={area.code} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
