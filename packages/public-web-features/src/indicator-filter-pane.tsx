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
import { Form, useLocation, useNavigate } from 'react-router';
import { cleanAreaName, displayGeographyGroups } from './geography-display';

import type { AreaGroup, IndicatorSelection, SelectedIndicator } from './indicator-loader';

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
  if (selection.areaType) {
    params.set('ats', selection.areaType);
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
  areaGroups,
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  selection: IndicatorSelection;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<string[]>([]);
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
    return `?${params.toString()}`;
  };
  // preventScrollReset: refreshing data in place must not lose the reader's position.
  const navigateTo = (args: Parameters<typeof selectionSearch>[0]) =>
    navigate({ search: searchFor(args) }, { preventScrollReset: true });

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
  const areaName = (code: string) => {
    const raw = areaGroups.flatMap(({ areas }) => areas).find((area) => area.code === code)?.name;
    return raw ? cleanAreaName(raw) : code;
  };

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
            <Autocomplete
              label="Search for an indicator"
              source={searchIndicators}
              onSelect={setPendingIndicator}
            />
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
          <Form method="get">
            {/* The current selection rides along so a submit adds to it rather than
                replacing it — the tree only carries what is newly ticked. */}
            {selection.fingertipsIds.map((id) => (
              <input key={id} type="hidden" name="is" value={id} />
            ))}
            {selection.areaCodes.map((code) => (
              <input key={code} type="hidden" name="as" value={code} />
            ))}
            {selection.areaLevels.map((level) => (
              <input key={level} type="hidden" name="als" value={level} />
            ))}
            {optionEntriesFor(new Set(selection.fingertipsIds.map(String))).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <GeographyTree
              groups={displayGeographyGroups(areaGroups)}
              name="as"
              onChange={setPending}
              selected={pending}
            />
            {/* Ticking gathers a pending set; adding them is the deliberate second step, so
                a long list can be built up without the page reloading between each tick.
                The button is always rendered: hiding it until something is ticked would
                leave the form unusable without scripting, since the count comes from state
                the browser only has once hydrated. */}
            <Button
              className="govuk-!-margin-top-3 govuk-!-margin-bottom-0"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (pending.length === 0) {
                  // Nothing gathered: let the form submit whatever is ticked in the DOM.
                  return;
                }
                event.preventDefault();
                setPending([]);
                // A group ticked in full collapses to its level name — one chip and one
                // query value instead of hundreds of area codes.
                const groups = displayGeographyGroups(areaGroups);
                const fullLevels = groups.filter(
                  ({ areas }) =>
                    areas.length > 0 && areas.every(({ code }) => pending.includes(code)),
                );
                const levelled = new Set(
                  fullLevels.flatMap(({ areas }) => areas.map(({ code }) => code)),
                );
                void navigateTo({
                  selection: {
                    ...selection,
                    areaCodes: [
                      ...new Set([
                        ...selection.areaCodes,
                        ...pending.filter((code) => !levelled.has(code)),
                      ]),
                    ],
                    areaLevels: [
                      ...new Set([...selection.areaLevels, ...fullLevels.map(({ name }) => name)]),
                    ],
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
