import { useId, useState } from 'react';

export interface GeographyGroup {
  /** The area type this group offers, e.g. 'Statistical regions'. */
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
 * The prototype's geography picker: a search over every area, above a list of area types
 * that each expand to their areas. A group's own checkbox takes or releases all of them.
 * Searching filters what is shown without changing what is ticked, so a narrowed list can
 * never silently drop a selection.
 */
export function GeographyTree({ groups, name, onChange, selected }: GeographyTreeProps) {
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  // The first group opens so the tree shows selectable areas rather than a row of
  // collapsed headings that give no sign of holding anything.
  const [expanded, setExpanded] = useState<string[]>(() => {
    const withSelection = groups
      .filter(({ areas }) => areas.some(({ code }) => selected.includes(code)))
      .map(({ name: groupName }) => groupName);
    return withSelection.length > 0 ? withSelection : groups.slice(0, 1).map(({ name }) => name);
  });

  const searching = query.trim() !== '';
  const matches = ({ name: areaName, code }: { name: string; code: string }) =>
    !searching ||
    areaName.toLowerCase().includes(query.trim().toLowerCase()) ||
    code.toLowerCase() === query.trim().toLowerCase();

  const toggleArea = (code: string, checked: boolean) =>
    onChange(checked ? [...selected, code] : selected.filter((value) => value !== code));

  const toggleGroup = (group: GeographyGroup, checked: boolean) => {
    const codes = group.areas.map((area) => area.code);
    onChange(
      checked
        ? [...selected, ...codes.filter((code) => !selected.includes(code))]
        : selected.filter((code) => !codes.includes(code)),
    );
  };

  return (
    <div>
      <div className="govuk-form-group govuk-!-margin-bottom-2">
        <label className="govuk-label govuk-label--s" htmlFor={`${idPrefix}-search`}>
          Add geographies
        </label>
        <input
          autoComplete="off"
          className="govuk-input fphd-geo-search"
          id={`${idPrefix}-search`}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Type to find geographies"
          type="search"
          value={query}
        />
      </div>
      <div className="fphd-geo-alt__tree" aria-label="Geographies grouped by level">
        {groups.map((group) => {
          const visible = group.areas.filter(matches);
          const chosen = group.areas.filter(({ code }) => selected.includes(code));
          // A search opens the groups it matches, so results are not hidden behind a toggle.
          const isOpen = searching ? visible.length > 0 : expanded.includes(group.name);
          const groupId = `${idPrefix}-grp-${group.name.toLowerCase().replace(/\W+/g, '-')}`;

          if (searching && visible.length === 0) {
            return null;
          }

          return (
            <div className="fphd-geo-alt__group" key={group.name}>
              <button
                aria-expanded={isOpen}
                className={`fphd-geo-alt__toggle${isOpen ? ' fphd-geo-alt__toggle--open' : ''}`}
                onClick={() =>
                  setExpanded((current) =>
                    current.includes(group.name)
                      ? current.filter((value) => value !== group.name)
                      : [...current, group.name],
                  )
                }
                type="button"
              >
                <span className="fphd-geo-alt__chevron" aria-hidden="true" />
                <span className="govuk-visually-hidden">
                  {isOpen ? 'Collapse' : 'Expand'} {group.name}
                </span>
              </button>
              <div className="govuk-checkboxes govuk-checkboxes--small fphd-geo-alt__group-cb">
                <div className="govuk-checkboxes__item">
                  <input
                    checked={group.areas.length > 0 && chosen.length === group.areas.length}
                    className="govuk-checkboxes__input"
                    id={groupId}
                    onChange={(event) => toggleGroup(group, event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <label className="govuk-label govuk-checkboxes__label" htmlFor={groupId}>
                    {group.name}{' '}
                    <span className="govuk-hint fphd-geo-alt__count">
                      ({chosen.length > 0 ? `${chosen.length} of ` : ''}
                      {group.areas.length})
                    </span>
                  </label>
                </div>
              </div>

              {isOpen ? (
                <div className="fphd-geo-alt__children">
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
                // Ticks in a collapsed group must still submit with the form.
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
