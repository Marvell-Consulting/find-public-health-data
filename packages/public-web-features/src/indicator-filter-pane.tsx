import { Autocomplete, Button, FilterCard, FilterChip, FilterChips, GeographyTree } from '@fphd/ui';
import { useState } from 'react';
import { Form, useLocation, useNavigate } from 'react-router';
import { cleanAreaName, displayGeographyGroups } from './geography-display';

import type {
  AreaGroup,
  IndicatorSelection,
  IndicatorSummary,
  SelectedIndicator,
} from './indicator-loader';

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
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  availableIndicators: IndicatorSummary[];
  selection: IndicatorSelection;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<string[]>([]);
  // Filter changes reload the page; carrying the hash and the option params keeps the
  // open tab open and the chosen options chosen.
  const current = new URLSearchParams(location.search);
  const searchOnly = (args: Parameters<typeof selectionSearch>[0]) => {
    const params = new URLSearchParams(selectionSearch(args));
    for (const key of ['ci', 'pt', 'sex']) {
      const value = current.get(key);
      if (value) {
        params.set(key, value);
      }
    }
    return `?${params.toString()}`;
  };
  // Links take the full string; navigate() must get search and hash separately, or the
  // hash is encoded into the last query value and the loader rejects it.
  const searchWithTab = (args: Parameters<typeof selectionSearch>[0]) =>
    `${searchOnly(args)}${location.hash}`;
  const navigateWithTab = (args: Parameters<typeof selectionSearch>[0]) =>
    navigate({ search: searchOnly(args), hash: location.hash.slice(1) });

  const unselected = availableIndicators.filter(
    ({ fingertipsId }) => !selection.fingertipsIds.includes(fingertipsId),
  );
  const areaName = (code: string) => {
    const raw = areaGroups.flatMap(({ areas }) => areas).find((area) => area.code === code)?.name;
    return raw ? cleanAreaName(raw) : code;
  };

  return (
    <>
      <FilterCard
        title="Selected indicators"
        onClear={selected.length > 0 ? searchWithTab({ selection, fingertipsIds: [] }) : undefined}
        body={
          selected.length === 0 ? (
            <p className="govuk-body">None selected</p>
          ) : (
            <FilterChips>
              {selected.map(({ detail }) => (
                <FilterChip
                  key={detail.fingertipsId}
                  onRemove={searchWithTab({
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
          unselected.length > 0 ? (
            <Autocomplete
              label="Search for an indicator"
              options={unselected.map(({ fingertipsId, name }) => ({
                value: String(fingertipsId),
                label: name,
              }))}
              onSelect={({ value }) =>
                navigateWithTab({
                  selection,
                  fingertipsIds: [...selection.fingertipsIds, Number(value)],
                })
              }
            />
          ) : null
        }
      />

      <FilterCard
        title="Geography filters"
        onClear={
          selection.areaCodes.length > 0 || selection.areaLevels.length > 0
            ? searchWithTab({ selection: { ...selection, areaCodes: [], areaLevels: [] } })
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
                  onRemove={searchWithTab({
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
                    onRemove={searchWithTab({
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
            {['ci', 'pt', 'sex'].map((key) => {
              const value = current.get(key);
              return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
            })}
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
                void navigateWithTab({
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
