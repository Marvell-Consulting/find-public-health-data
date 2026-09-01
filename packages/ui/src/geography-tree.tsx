import Checkboxes from '@not-govuk/checkboxes';
import TextInput from '@not-govuk/text-input';
import { useId, useState } from 'react';

export interface GeographyGroup {
  /** The display level this group offers, e.g. 'Local authorities'. */
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

// Matches the prototype: cap rendered checkboxes per group so a level with thousands of
// areas (GP practices) cannot flood the DOM; the search reaches everything regardless.
const CHILD_CAP = 100;

/**
 * The prototype's geography picker: a search over every area, above a list of levels that
 * each expand to their areas. A group's own checkbox takes or releases all of them.
 * Searching filters what is shown without changing what is ticked, so a narrowed list can
 * never silently drop a selection.
 */
export function GeographyTree({ groups, name, onChange, selected }: GeographyTreeProps) {
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  // Groups holding a selection open so their ticks are visible; the rest start collapsed.
  const [expanded, setExpanded] = useState<string[]>(() =>
    groups
      .filter(({ areas }) => areas.some(({ code }) => selected.includes(code)))
      .map(({ name: groupName }) => groupName),
  );

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
      <TextInput
        autoComplete="off"
        className="fphd-geo-search govuk-!-margin-bottom-2"
        id={`${idPrefix}-search`}
        label={<span className="govuk-label--s">Add geographies</span>}
        name=""
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Type to find geographies"
        type="search"
        value={query}
      />
      <fieldset className="fphd-geo-alt">
        <legend className="govuk-visually-hidden">Geographies grouped by level</legend>
        <div className="fphd-geo-alt__tree">
          {groups.map((group) => {
            const visible = group.areas.filter(matches);
            const chosen = group.areas.filter(({ code }) => selected.includes(code));
            // A search opens the groups it matches, so results are not hidden behind a toggle.
            const isOpen = searching ? visible.length > 0 : expanded.includes(group.name);
            const groupId = `${idPrefix}-grp-${group.name.toLowerCase().replace(/\W+/g, '-')}`;
            // Ticked areas stay rendered past the cap, so their state remains visible.
            const shown = visible
              .filter((_, index) => index < CHILD_CAP)
              .concat(visible.slice(CHILD_CAP).filter(({ code }) => selected.includes(code)));

            if (searching && visible.length === 0) {
              return null;
            }

            const groupOption = {
              label: group.name,
              // The component's own `selected` is uncontrolled (defaultChecked); `checked`
              // rides the option spread onto the input so React owns the state.
              checked: group.areas.length > 0 && chosen.length === group.areas.length,
              value: group.name,
            };

            return (
              <div key={group.name}>
                <div className="fphd-geo-alt__group">
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
                  <Checkboxes
                    className="fphd-geo-alt__group-cb"
                    classModifiers="small"
                    id={groupId}
                    label={
                      <span className="govuk-visually-hidden">Every area in {group.name}</span>
                    }
                    name=""
                    onChange={(event) => toggleGroup(group, event.currentTarget.checked)}
                    options={[groupOption]}
                  />
                </div>

                {isOpen ? (
                  <div className="fphd-geo-alt__children">
                    <Checkboxes
                      id={`${groupId}-areas`}
                      label={<span className="govuk-visually-hidden">Areas in {group.name}</span>}
                      name={name}
                      onChange={(event) => toggleArea(event.target.value, event.target.checked)}
                      classModifiers="small"
                      options={shown.map((area) => ({
                        label: area.name,
                        checked: selected.includes(area.code),
                        value: area.code,
                      }))}
                    />
                    {visible.length > shown.length ? (
                      <p className="govuk-body-s fphd-geo-alt__more">
                        Showing {shown.length} of {visible.length} — search to find the rest
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {/* Ticks in a collapsed group, or hidden by a search or the cap, must
                  still submit with the form. */}
                {chosen
                  .filter(({ code }) => !isOpen || !shown.some((area) => area.code === code))
                  .map((area) => (
                    <input key={area.code} name={name} type="hidden" value={area.code} />
                  ))}
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
