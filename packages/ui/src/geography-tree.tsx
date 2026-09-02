import Checkboxes from '@not-govuk/checkboxes';
import TextInput from '@not-govuk/text-input';
import { useEffect, useId, useRef, useState } from 'react';

export interface GeographyArea {
  code: string;
  name: string;
}

interface GeographyTreeProps {
  /** The display level names, offered whether or not their areas are loaded yet. */
  levels: string[];
  /** Field name for each area checkbox, so the tree works inside a plain form. */
  name: string;
  onChange: (selected: string[]) => void;
  onLevelsChange: (levels: string[]) => void;
  selected: string[];
  selectedLevels: string[];
}

// Caps rendered checkboxes per level so thousands of GP practices cannot flood the DOM;
// the search reaches everything server-side regardless.
const CHILD_CAP = 100;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The prototype's geography picker, fed on demand: a level's areas load when it first
 * expands and the search asks the server, so the catalogue never ships with the page.
 * A level's own checkbox is a real `als` form control, which also makes whole-level
 * selection work without scripting.
 */
export function GeographyTree({
  levels,
  name,
  onChange,
  onLevelsChange,
  selected,
  selectedLevels,
}: GeographyTreeProps) {
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, GeographyArea[] | 'loading'>>({});
  const [searchGroups, setSearchGroups] = useState<{ name: string; areas: GeographyArea[] }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searching = query.trim() !== '';

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searching) {
      setSearchGroups([]);
      return;
    }
    const controller = new AbortController();
    searchTimer.current = setTimeout(() => {
      fetch(`/geographies?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { groups: [] }))
        .then(({ groups }: { groups: { name: string; areas: GeographyArea[] }[] }) => {
          if (!controller.signal.aborted) {
            setSearchGroups(groups);
          }
        })
        .catch(() => {});
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(searchTimer.current);
      controller.abort();
    };
  }, [query, searching]);

  const toggleExpanded = (level: string) => {
    setExpanded((current) =>
      current.includes(level) ? current.filter((value) => value !== level) : [...current, level],
    );
    if (!loaded[level]) {
      setLoaded((current) => ({ ...current, [level]: 'loading' }));
      fetch(`/geographies?level=${encodeURIComponent(level)}`)
        .then((response) => (response.ok ? response.json() : { areas: [] }))
        .then(({ areas }: { areas: GeographyArea[] }) =>
          setLoaded((current) => ({ ...current, [level]: areas })),
        )
        .catch(() => setLoaded((current) => ({ ...current, [level]: [] })));
    }
  };

  const toggleArea = (code: string, checked: boolean) =>
    onChange(checked ? [...selected, code] : selected.filter((value) => value !== code));

  const toggleLevel = (level: string, checked: boolean) =>
    onLevelsChange(
      checked ? [...selectedLevels, level] : selectedLevels.filter((value) => value !== level),
    );

  const groups = searching
    ? searchGroups
    : levels.map((level) => ({
        name: level,
        areas: Array.isArray(loaded[level]) ? (loaded[level] as GeographyArea[]) : [],
      }));
  const shownFor = (group: { name: string; areas: GeographyArea[] }) =>
    // Ticked areas stay rendered past the cap, so their state remains visible.
    group.areas
      .filter((_, index) => index < CHILD_CAP)
      .concat(group.areas.slice(CHILD_CAP).filter(({ code }) => selected.includes(code)));
  const visibleCodes = new Set(
    groups
      .filter(({ name: groupName }) => searching || expanded.includes(groupName))
      .flatMap((group) => shownFor(group).map(({ code }) => code)),
  );

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
            const isOpen = searching || expanded.includes(group.name);
            const isLoading = !searching && loaded[group.name] === 'loading';
            const groupId = `${idPrefix}-grp-${group.name.toLowerCase().replace(/\W+/g, '-')}`;
            const shown = shownFor(group);
            // The component's own `selected` is uncontrolled; `checked` rides the option
            // spread onto the input so React owns the state.
            const levelOption = {
              label: group.name,
              checked: selectedLevels.includes(group.name),
              value: group.name,
            };

            return (
              <div key={group.name}>
                <div className="fphd-geo-alt__group">
                  {searching ? null : (
                    <button
                      aria-expanded={isOpen}
                      className={`fphd-geo-alt__toggle${isOpen ? ' fphd-geo-alt__toggle--open' : ''}`}
                      onClick={() => toggleExpanded(group.name)}
                      type="button"
                    >
                      <span className="fphd-geo-alt__chevron" aria-hidden="true" />
                      <span className="govuk-visually-hidden">
                        {isOpen ? 'Collapse' : 'Expand'} {group.name}
                      </span>
                    </button>
                  )}
                  <Checkboxes
                    className="fphd-geo-alt__group-cb"
                    classModifiers="small"
                    id={groupId}
                    label={<span className="govuk-visually-hidden">All of {group.name}</span>}
                    name="als"
                    onChange={(event) => toggleLevel(group.name, event.currentTarget.checked)}
                    options={[levelOption]}
                  />
                </div>

                {isOpen ? (
                  <div className="fphd-geo-alt__children">
                    {isLoading ? (
                      <p className="govuk-body-s fphd-geo-alt__more">Loading…</p>
                    ) : (
                      <>
                        <Checkboxes
                          id={`${groupId}-areas`}
                          label={
                            <span className="govuk-visually-hidden">Areas in {group.name}</span>
                          }
                          name={name}
                          onChange={(event) => toggleArea(event.target.value, event.target.checked)}
                          classModifiers="small"
                          options={shown.map((area) => ({
                            label: area.name,
                            checked: selected.includes(area.code),
                            value: area.code,
                          }))}
                        />
                        {group.areas.length > shown.length ? (
                          <p className="govuk-body-s fphd-geo-alt__more">
                            Showing {shown.length} of {group.areas.length} — search to find the rest
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      {/* Ticks hidden by collapse, a search, or the cap must still submit. */}
      {selected
        .filter((code) => !visibleCodes.has(code))
        .map((code) => (
          <input key={code} name={name} type="hidden" value={code} />
        ))}
    </div>
  );
}
