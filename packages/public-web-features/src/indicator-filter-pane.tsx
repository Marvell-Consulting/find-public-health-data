import {
  Autocomplete,
  type AutocompleteOption,
  Button,
  FilterCard,
  FilterChip,
  FilterChips,
  GeographyTree,
} from '@fphd/ui';
import { useCallback, useState } from 'react';
import { Form, Link, useLocation, useNavigate } from 'react-router';
import { DISPLAY_LEVEL_NAMES } from './geography-display';

import type {
  IndicatorSelection,
  IndicatorSummary,
  SelectedArea,
  SelectedIndicator,
} from './indicator-loader';

// Every selection change lands here, off the deep-link route: with an empty query that
// route's loader would fall back to the indicator in its address and re-select it.
const INDICATORS_PATH = '/indicators';

/** The query string for a selection, so every control links to a complete page state. */
export function selectionSearch({
  selection,
  fingertipsIds = selection.fingertipsIds,
}: {
  selection: IndicatorSelection;
  fingertipsIds?: number[];
}) {
  const params = new URLSearchParams();
  for (const id of fingertipsIds) {
    params.append('is', String(id));
  }
  for (const code of selection.areaCodes) {
    params.append('as', code);
  }
  for (const level of selection.areaLevels) {
    params.append('als', level);
  }
  return `?${params.toString()}`;
}

export function FilterPane({
  selected,
  selectedAreas = [],
  findResults = [],
  findSubject = '',
  selection,
}: {
  selected: SelectedIndicator[];
  selectedAreas?: SelectedArea[];
  findResults?: IndicatorSummary[];
  findSubject?: string;
  selection: IndicatorSelection;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<string[]>([]);
  const [pendingLevels, setPendingLevels] = useState<string[]>(selection.areaLevels);
  const [pendingIndicator, setPendingIndicator] = useState<AutocompleteOption | null>(null);
  const current = new URLSearchParams(location.search);
  // Option params ride along only for tables the selection still shows — nothing lingers.
  const optionEntriesFor = (keptIds: Set<string>) =>
    [...current.entries()].filter(([key]) => {
      const suffix = key.match(/^(?:ci|pt|sex|cmp|cr|tab)-(.+)$/)?.[1];
      return suffix === 'compare' || (suffix !== undefined && keptIds.has(suffix));
    });
  const searchFor = (args: Parameters<typeof selectionSearch>[0]) => {
    const params = new URLSearchParams(selectionSearch(args));
    const keptIds = new Set((args.fingertipsIds ?? args.selection.fingertipsIds).map(String));
    for (const [key, value] of optionEntriesFor(keptIds)) {
      params.set(key, value);
    }
    // An active no-script search rides along, so several matches can be added in a row.
    if (findSubject) {
      params.set('find', findSubject);
    }
    const search = params.toString();
    return search ? `${INDICATORS_PATH}?${search}` : INDICATORS_PATH;
  };
  // preventScrollReset: refreshing data in place must not lose the reader's position.
  const navigateTo = (args: Parameters<typeof selectionSearch>[0]) =>
    navigate(searchFor(args), { preventScrollReset: true });

  // Stable identity keeps the widget mounted; failures throw so they never read as
  // empty results, and selected matches stay listed — the loader de-duplicates re-adds.
  const searchIndicators = useCallback(async (query: string, signal: AbortSignal) => {
    const response = await fetch(`/indicators/search?q=${encodeURIComponent(query)}`, {
      signal,
    });
    if (!response.ok) {
      throw new Error(`search failed: ${response.status}`);
    }
    const { indicators } = (await response.json()) as {
      indicators: { fingertipsId: number; name: string }[];
    };
    return indicators.map(({ fingertipsId, name }) => ({
      value: String(fingertipsId),
      label: name,
    }));
  }, []);
  const findMatches = findResults.filter(
    ({ fingertipsId }) => !selection.fingertipsIds.includes(fingertipsId),
  );
  const areaName = (code: string) => selectedAreas.find((area) => area.code === code)?.name ?? code;

  return (
    <>
      <FilterCard
        title="Selected indicators"
        onClear={selected.length > 0 ? searchFor({ selection, fingertipsIds: [] }) : undefined}
        body={
          selected.length === 0 ? (
            <p className="govuk-body">None selected</p>
          ) : (
            <FilterChips>
              {selected.map(({ detail }) => (
                <FilterChip
                  key={detail.fingertipsId}
                  onRemove={searchFor({
                    selection,
                    fingertipsIds: selection.fingertipsIds.filter(
                      (id) => id !== detail.fingertipsId,
                    ),
                  })}
                  removeLabel={detail.name}
                  value={String(detail.fingertipsId)}
                >
                  {detail.name}
                </FilterChip>
              ))}
            </FilterChips>
          )
        }
        footer={
          <>
            <Form action={INDICATORS_PATH} method="get">
              {/* The whole selection rides in hidden inputs so a no-script search keeps it. */}
              {selection.fingertipsIds.map((id) => (
                <input key={id} name="is" type="hidden" value={id} />
              ))}
              {selection.areaCodes.map((code) => (
                <input key={code} name="as" type="hidden" value={code} />
              ))}
              {selection.areaLevels.map((level) => (
                <input key={level} name="als" type="hidden" value={level} />
              ))}
              {optionEntriesFor(new Set(selection.fingertipsIds.map(String))).map(
                ([key, value]) => (
                  <input key={key} name={key} type="hidden" value={value} />
                ),
              )}
              <Autocomplete
                defaultValue={findSubject}
                label="Search for an indicator"
                name="find"
                source={searchIndicators}
                onSelect={setPendingIndicator}
              />
              <noscript>
                <Button className="govuk-button--secondary govuk-!-margin-bottom-0" type="submit">
                  Search
                </Button>
              </noscript>
            </Form>
            {/* Two-step add: picking readies, the button commits — a misclick costs nothing. */}
            {pendingIndicator ? (
              <Button
                className="fphd-button--full-width govuk-!-margin-bottom-0"
                onClick={() => {
                  setPendingIndicator(null);
                  void navigateTo({
                    selection,
                    fingertipsIds: [...selection.fingertipsIds, Number(pendingIndicator.value)],
                  });
                }}
                type="button"
              >
                Add indicator
              </Button>
            ) : null}
            {findSubject ? (
              findMatches.length === 0 ? (
                <p className="govuk-body govuk-!-margin-top-3 govuk-!-margin-bottom-0">
                  {findResults.length > 0
                    ? 'All matching indicators are already selected'
                    : 'No indicators found'}
                </p>
              ) : (
                <ul className="govuk-list govuk-!-margin-top-3 govuk-!-margin-bottom-0">
                  {findMatches.map(({ fingertipsId, name }) => (
                    <li key={fingertipsId}>
                      <Link
                        className="govuk-link"
                        preventScrollReset
                        to={searchFor({
                          selection,
                          fingertipsIds: [...selection.fingertipsIds, fingertipsId],
                        })}
                      >
                        {name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </>
        }
      />

      <FilterCard
        title="Geography filters"
        onClear={
          selection.areaCodes.length > 0 || selection.areaLevels.length > 0
            ? searchFor({ selection: { ...selection, areaCodes: [], areaLevels: [] } })
            : undefined
        }
        body={
          <>
            <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2">
              Selected areas
            </p>
            <FilterChips>
              {/* England is the default comparison, so it has no remove control. */}
              <FilterChip value="E92000001">England</FilterChip>
              {/* A whole level is one chip, not one per area within it. */}
              {selection.areaLevels.map((level) => (
                <FilterChip
                  key={level}
                  onRemove={searchFor({
                    selection: {
                      ...selection,
                      areaLevels: selection.areaLevels.filter((value) => value !== level),
                    },
                  })}
                  removeLabel={level}
                  value={level}
                >
                  {level}
                </FilterChip>
              ))}
              {selection.areaCodes
                .filter((code) => code !== 'E92000001')
                .map((code) => (
                  <FilterChip
                    key={code}
                    onRemove={searchFor({
                      selection: {
                        ...selection,
                        areaCodes: selection.areaCodes.filter((value) => value !== code),
                      },
                    })}
                    removeLabel={areaName(code)}
                    value={code}
                  >
                    {areaName(code)}
                  </FilterChip>
                ))}
            </FilterChips>
          </>
        }
        footer={
          <Form action={INDICATORS_PATH} method="get">
            {/* The current selection rides along so a submit adds to it; levels are the
                tree's own checkboxes, so they are not doubled here. */}
            {selection.fingertipsIds.map((id) => (
              <input key={id} type="hidden" name="is" value={id} />
            ))}
            {selection.areaCodes.map((code) => (
              <input key={code} type="hidden" name="as" value={code} />
            ))}
            {optionEntriesFor(new Set(selection.fingertipsIds.map(String))).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <GeographyTree
              levels={DISPLAY_LEVEL_NAMES}
              name="as"
              onChange={setPending}
              onLevelsChange={setPendingLevels}
              selected={pending}
              selectedLevels={pendingLevels}
            />
            {/* The button is always rendered: without scripting the tick count only
                exists in the browser, and the form must stay submittable. */}
            <Button
              className="govuk-!-margin-top-3 govuk-!-margin-bottom-0"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                const levelsChanged =
                  pendingLevels.length !== selection.areaLevels.length ||
                  pendingLevels.some((level) => !selection.areaLevels.includes(level));
                if (pending.length === 0 && !levelsChanged) {
                  // Nothing gathered: let the form submit whatever is ticked in the DOM.
                  return;
                }
                event.preventDefault();
                setPending([]);
                void navigateTo({
                  selection: {
                    ...selection,
                    areaCodes: [...new Set([...selection.areaCodes, ...pending])],
                    areaLevels: pendingLevels,
                  },
                });
              }}
              type="submit"
            >
              Add selected geographies{pending.length > 0 ? ` (${pending.length})` : ''}
            </Button>
          </Form>
        }
      />
    </>
  );
}
