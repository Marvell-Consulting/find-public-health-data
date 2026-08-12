import { Autocomplete, FilterCard, FilterChip, FilterChips, GeographyTree } from '@fphd/ui';
import { useState } from 'react';
import { Form, useNavigate } from 'react-router';

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
  const [pending, setPending] = useState<string[]>([]);

  const unselected = availableIndicators.filter(
    ({ fingertipsId }) => !selection.fingertipsIds.includes(fingertipsId),
  );
  const areaName = (code: string) =>
    areaGroups.flatMap(({ areas }) => areas).find((area) => area.code === code)?.name ?? code;

  return (
    <>
      <FilterCard
        title="Selected indicators"
        onClear={
          selected.length > 0 ? selectionSearch({ selection, fingertipsIds: [] }) : undefined
        }
        body={
          selected.length === 0 ? (
            <p className="govuk-body">None selected</p>
          ) : (
            <FilterChips>
              {selected.map(({ detail }) => (
                <FilterChip
                  key={detail.fingertipsId}
                  onRemove={selectionSearch({
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
                navigate({
                  search: selectionSearch({
                    selection,
                    fingertipsIds: [...selection.fingertipsIds, Number(value)],
                  }),
                })
              }
            />
          ) : null
        }
      />

      <FilterCard
        title="Geography filters"
        onClear={
          selection.areaCodes.length > 0
            ? selectionSearch({ selection: { ...selection, areaCodes: [] } })
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
              {selection.areaCodes
                .filter((code) => code !== 'E92000001')
                .map((code) => (
                  <FilterChip
                    key={code}
                    onRemove={selectionSearch({
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
            <GeographyTree
              groups={areaGroups.map(({ areaType, areas }) => ({ name: areaType, areas }))}
              name="as"
              onChange={setPending}
              selected={pending}
            />
            {/* Ticking gathers a pending set; adding them is the deliberate second step, so
                a long list can be built up without the page reloading between each tick.
                The button is always rendered: hiding it until something is ticked would
                leave the form unusable without scripting, since the count comes from state
                the browser only has once hydrated. */}
            <button
              className="govuk-button govuk-!-margin-top-3 govuk-!-margin-bottom-0"
              onClick={(event) => {
                if (pending.length === 0) {
                  // Nothing gathered: let the form submit whatever is ticked in the DOM.
                  return;
                }
                event.preventDefault();
                setPending([]);
                navigate({
                  search: selectionSearch({
                    selection: {
                      ...selection,
                      areaCodes: [...new Set([...selection.areaCodes, ...pending])],
                    },
                  }),
                });
              }}
              type="submit"
            >
              Add selected geographies{pending.length > 0 ? ` (${pending.length})` : ''}
            </button>
          </Form>
        }
      />
    </>
  );
}
