import Button from '@not-govuk/button';
import Checkboxes from '@not-govuk/checkboxes';
import Hint from '@not-govuk/hint';
import Input from '@not-govuk/input';
import Label from '@not-govuk/label';
import { useEffect, useId, useRef, useState } from 'react';

export interface GeographyArea {
  code: string;
  name: string;
}

interface GeographyTreeProps {
  fallback?:
    | {
        query: string;
        level: string;
        groups: { name: string; areas: GeographyArea[] }[];
        previews?: { name: string; areas: GeographyArea[] }[];
        error: boolean;
      }
    | undefined;
  /** The display level names, offered whether or not their areas are loaded yet. */
  levels: string[];
  /** Field name for each area checkbox, so the tree works inside a plain form. */
  name: string;
  /** Field name for each level checkbox. Defaults to 'als'. */
  levelName?: string;
  /** Maximum number of area ticks allowed. Stops accepting new ticks at the cap. */
  maxAreaTicks?: number;
  onChange: (selected: string[]) => void;
  onLevelsChange: (levels: string[]) => void;
  selected: string[];
  selectedLevels: string[];
}

// The page preloads one extra row to tell us whether a level exceeds the rendered cap;
// search reaches everything server-side regardless.
const CHILD_CAP = 100;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Geography picker with bounded server-loaded previews, so normal expansion is instant
 * without putting whole GP and MSOA catalogues in the page. Search asks the server for
 * everything beyond those previews. A level's own checkbox is a real `als` form control,
 * which also makes whole-level selection work without scripting.
 */
export function GeographyTree({
  levels,
  name,
  levelName = 'als',
  maxAreaTicks,
  onChange,
  onLevelsChange,
  selected,
  selectedLevels,
  fallback,
}: GeographyTreeProps) {
  const idPrefix = useId();
  const [query, setQuery] = useState(fallback?.query ?? '');
  const [expanded, setExpanded] = useState<string[]>(fallback?.level ? [fallback.level] : []);
  const [loaded, setLoaded] = useState<Record<string, GeographyArea[] | 'loading'>>(() =>
    Object.fromEntries(
      [...(fallback?.previews ?? []), ...(fallback?.level ? fallback.groups : [])].map(
        ({ name, areas }) => [name, areas],
      ),
    ),
  );
  const [searchGroups, setSearchGroups] = useState(fallback?.groups ?? []);
  const [hasSearchResults, setHasSearchResults] = useState(Boolean(fallback?.query.trim()));
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>(
    fallback?.error ? 'error' : 'idle',
  );
  const [failedLevels, setFailedLevels] = useState<string[]>(
    fallback?.error && fallback.level ? [fallback.level] : [],
  );
  const [retry, setRetry] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const levelRequests = useRef(new Map<string, AbortController>());

  const searching = query.trim() !== '';

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searching) {
      setSearchGroups([]);
      setHasSearchResults(false);
      setSearchStatus('idle');
      return;
    }
    setSearchStatus('loading');
    const controller = new AbortController();
    searchTimer.current = setTimeout(() => {
      fetch(`/geographies?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`geographies answered ${response.status}`);
          return response.json();
        })
        .then(({ groups }: { groups: { name: string; areas: GeographyArea[] }[] }) => {
          if (!controller.signal.aborted) {
            setSearchGroups(groups);
            setHasSearchResults(true);
            setSearchStatus('idle');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchStatus('error');
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(searchTimer.current);
      controller.abort();
    };
  }, [query, searching, retry]);

  useEffect(
    () => () => {
      for (const controller of levelRequests.current.values()) controller.abort();
      levelRequests.current.clear();
    },
    [],
  );

  const toggleExpanded = (level: string) => {
    setExpanded((current) =>
      current.includes(level) ? current.filter((value) => value !== level) : [...current, level],
    );
    if (!loaded[level]) {
      const controller = new AbortController();
      levelRequests.current.set(level, controller);
      setFailedLevels((current) => current.filter((value) => value !== level));
      setLoaded((current) => ({ ...current, [level]: 'loading' }));
      fetch(`/geographies?level=${encodeURIComponent(level)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`geographies answered ${response.status}`);
          }
          return response.json();
        })
        .then(({ areas }: { areas: GeographyArea[] }) => {
          if (!controller.signal.aborted) {
            setLoaded((current) => ({ ...current, [level]: areas }));
          }
        })
        // A failed fetch collapses the level unloaded, so expanding again retries.
        .catch(() => {
          if (controller.signal.aborted) return;
          setLoaded(({ [level]: _, ...rest }) => rest);
          setExpanded((current) => current.filter((value) => value !== level));
          setFailedLevels((current) => [...new Set([...current, level])]);
        })
        .finally(() => {
          if (levelRequests.current.get(level) === controller) levelRequests.current.delete(level);
        });
    }
  };

  const atCap = maxAreaTicks !== undefined && selected.length >= maxAreaTicks;

  const toggleArea = (code: string, checked: boolean) => {
    if (checked && atCap) return;
    onChange(
      checked ? [...new Set([...selected, code])] : selected.filter((value) => value !== code),
    );
  };

  const toggleLevel = (level: string, checked: boolean) =>
    onLevelsChange(
      checked
        ? [...new Set([...selectedLevels, level])]
        : selectedLevels.filter((value) => value !== level),
    );

  const browseGroups = levels.map((level) => ({
    name: level,
    areas: Array.isArray(loaded[level]) ? (loaded[level] as GeographyArea[]) : [],
  }));
  const showingSearchResults = searching && hasSearchResults;
  const groups = showingSearchResults ? searchGroups : browseGroups;
  const shownFor = (group: { name: string; areas: GeographyArea[] }) =>
    // Ticked areas stay rendered past the cap, so their state remains visible.
    group.areas
      .filter((_, index) => index < CHILD_CAP)
      .concat(group.areas.slice(CHILD_CAP).filter(({ code }) => selected.includes(code)));
  const visibleCodes = new Set(
    groups
      .filter(({ name: groupName }) => showingSearchResults || expanded.includes(groupName))
      .flatMap((group) => shownFor(group).map(({ code }) => code)),
  );

  return (
    <div>
      <div className="govuk-form-group govuk-!-margin-bottom-2">
        <Label classModifiers="s" htmlFor={`${idPrefix}-search`}>
          Add geographies
        </Label>
        <Input
          autoComplete="off"
          className="fphd-geo-search"
          id={`${idPrefix}-search`}
          name="geo-q"
          maxLength={100}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Type to find geographies"
          type="search"
          value={query}
        />
      </div>
      <noscript>
        <Button classModifiers="secondary" type="submit">
          Find geographies
        </Button>
      </noscript>
      {maxAreaTicks !== undefined ? (
        <Hint className="govuk-body-s">
          Select up to {maxAreaTicks} areas. England is included for comparison.
        </Hint>
      ) : null}
      <fieldset className="fphd-geo-alt">
        <legend className="govuk-visually-hidden">Geographies grouped by level</legend>
        <div className="fphd-geo-alt__tree">
          <div role="status">
            {searchStatus === 'loading' ? (
              <p className="govuk-visually-hidden">Finding geographies…</p>
            ) : null}
            {searchStatus === 'error' ? (
              <p className="govuk-body-s">Geography search is not working right now. Try again.</p>
            ) : null}
            {searching && searchStatus === 'idle' && searchGroups.length === 0 ? (
              <p className="govuk-body-s">
                No geographies found. Try a different name or area code.
              </p>
            ) : null}
          </div>
          {searchStatus === 'error' ? (
            <Button
              classModifiers="secondary"
              type="submit"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
          {groups.map((group) => {
            const isOpen = showingSearchResults || expanded.includes(group.name);
            const isLoading = !showingSearchResults && loaded[group.name] === 'loading';
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
                  {showingSearchResults ? null : (
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
                    name={levelName}
                    onChange={(event) => toggleLevel(group.name, event.currentTarget.checked)}
                    options={[levelOption]}
                  />
                </div>

                <noscript>
                  <Button
                    className="govuk-!-margin-bottom-2"
                    classModifiers="secondary"
                    name="geo-level"
                    type="submit"
                    value={group.name}
                  >
                    Show areas in {group.name}
                  </Button>
                </noscript>
                {failedLevels.includes(group.name) ? (
                  <p className="govuk-body-s" role="status">
                    Could not load {group.name}. Expand it to try again.
                  </p>
                ) : null}

                {isOpen ? (
                  <div className="fphd-geo-alt__children">
                    {isLoading ? (
                      <p className="govuk-body-s" role="status">
                        Loading {group.name}…
                      </p>
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
                            disabled: !selected.includes(area.code) && atCap,
                          }))}
                        />
                        {group.areas.length > CHILD_CAP ? (
                          <p className="govuk-body-s fphd-geo-alt__more">
                            Showing the first {CHILD_CAP} — search to find the rest
                          </p>
                        ) : null}
                        {atCap ? (
                          <p className="govuk-body-s fphd-geo-alt__more">
                            You have selected the maximum number of areas.
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
      {selectedLevels
        .filter((level) => !groups.some(({ name }) => name === level))
        .map((level) => (
          <input key={level} name={levelName} type="hidden" value={level} />
        ))}
      {selected
        .filter((code) => !visibleCodes.has(code))
        .map((code) => (
          <input key={code} name={name} type="hidden" value={code} />
        ))}
    </div>
  );
}
