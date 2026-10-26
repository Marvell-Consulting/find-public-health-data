import {
  Autocomplete,
  type AutocompleteOption,
  Button,
  Checkboxes,
  FilterChip,
  FilterChips,
} from '@fphd/ui';
import { useEffect, useId, useState } from 'react';
import { Form, Link } from 'react-router';
import { LIST_PARAMS, PERIOD_PARAMS, removeFrom, type SearchState } from './url.ts';

export function HiddenFilters({
  state,
  except,
  extraParams = {},
  includePeriod = true,
}: {
  state: SearchState;
  except?: keyof SearchState | (keyof SearchState)[];
  extraParams?: Record<string, string>;
  includePeriod?: boolean;
}) {
  const excluded = new Set(Array.isArray(except) ? except : [except]);
  return (
    <>
      {Object.entries(extraParams).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {!excluded.has('q') && state.q ? <input name="q" type="hidden" value={state.q} /> : null}
      {!excluded.has('subtopics')
        ? state.subtopics?.map((slug) => (
            <input key={slug} name="subtopic" type="hidden" value={slug} />
          ))
        : null}
      {includePeriod
        ? PERIOD_PARAMS.map((name) =>
            !excluded.has(name) && state[name] ? (
              <input key={name} name={name} type="hidden" value={state[name]} />
            ) : null,
          )
        : null}
      {LIST_PARAMS.filter(({ stateKey }) => !excluded.has(stateKey)).map(({ param, stateKey }) =>
        (state[stateKey] as string[]).map((v) => (
          <input key={`${param}-${v}`} name={param} type="hidden" value={v} />
        )),
      )}
    </>
  );
}

export function FilterDimensionChoices({
  action,
  extraParams,
  label,
  options,
  param,
  state,
  stateKey,
  onChange,
}: {
  action: string;
  extraParams: Record<string, string>;
  label: string;
  options: AutocompleteOption[];
  param: string;
  state: SearchState;
  stateKey: keyof SearchState;
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const selected = state[stateKey] as string[];
  const [values, setValues] = useState(selected);
  useEffect(() => setValues(selected), [selected]);
  return (
    <Form action={action} method="get" preventScrollReset>
      <HiddenFilters state={state} extraParams={extraParams} except={stateKey} />
      <Checkboxes
        id={id}
        name={param}
        label={label}
        classModifiers="small"
        options={options.map((option) => ({ ...option, checked: values.includes(option.value) }))}
        onChange={(event) => {
          const next = event.currentTarget.checked
            ? [...values, event.currentTarget.value]
            : values.filter((value) => value !== event.currentTarget.value);
          setValues(next);
          onChange(next);
        }}
      />
      <noscript>
        <Button type="submit">Apply filters</Button>
      </noscript>
    </Form>
  );
}

interface FilterDimensionBodyProps {
  urlFor: (state: SearchState) => string;
  state: SearchState;
  stateKey: keyof SearchState;
  selectedLabel: string;
  selected: string[];
  facetLabelOf: (value: string) => string;
  isTopicDimension?: boolean | undefined;
}

export function FilterDimensionBody({
  urlFor,
  state,
  stateKey,
  selectedLabel,
  selected,
  facetLabelOf,
  isTopicDimension,
}: FilterDimensionBodyProps) {
  return (
    <div className="govuk-!-margin-bottom-3">
      <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">{selectedLabel}</p>
      {selected.length === 0 ? (
        <div className="fphd-filter-chips fphd-filter-chips--inline govuk-!-margin-bottom-4">
          <p className="govuk-body-s govuk-!-margin-bottom-0">None selected</p>
        </div>
      ) : (
        <FilterChips className="govuk-!-margin-bottom-4">
          {selected.map((v) => {
            const chipLabel = facetLabelOf(v);
            return (
              <FilterChip
                key={v}
                onRemove={urlFor(removeFrom(state, stateKey, v))}
                removeLabel={chipLabel}
                replace
                value={v}
              >
                {isTopicDimension ? (
                  <Link className="govuk-link" to={`/topics/${v}`}>
                    {chipLabel}
                  </Link>
                ) : (
                  chipLabel
                )}
              </FilterChip>
            );
          })}
        </FilterChips>
      )}
    </div>
  );
}

interface FilterDimensionFooterProps {
  action: string;
  extraParams: Record<string, string>;
  param: string;
  autocompleteLabel: string;
  addButtonLabel: string;
  noResultsMessage: string;
  options: AutocompleteOption[];
  onAdd: (value: string) => void;
  state: SearchState;
  draftValue: string | undefined;
  onDraftChange: (value: string) => void;
}

export function FilterDimensionFooter({
  action,
  extraParams,
  param,
  autocompleteLabel,
  addButtonLabel,
  noResultsMessage,
  options,
  onAdd,
  state,
  draftValue,
  onDraftChange,
}: FilterDimensionFooterProps) {
  const [pending, setPending] = useState<AutocompleteOption | null>(null);

  return (
    <div className="fphd-search-dimension govuk-!-margin-bottom-3">
      <Form action={action} method="get" replace preventScrollReset>
        <HiddenFilters state={state} extraParams={extraParams} />
        <Autocomplete
          defaultValue={draftValue ?? ''}
          label={autocompleteLabel}
          name={`${param}-add`}
          noResultsMessage={noResultsMessage}
          options={options}
          onSelect={(opt) => setPending(opt)}
          onInputChange={(value) => {
            setPending(null);
            onDraftChange(value);
          }}
        />
        <noscript>
          <Button
            className="fphd-button--full-width govuk-!-margin-top-2 govuk-!-margin-bottom-0"
            type="submit"
          >
            {addButtonLabel}
          </Button>
        </noscript>
      </Form>
      {pending ? (
        <Button
          className="fphd-button--full-width govuk-!-margin-top-2 govuk-!-margin-bottom-0"
          onClick={() => {
            onAdd(pending.value);
            setPending(null);
          }}
          type="button"
        >
          {addButtonLabel}
        </Button>
      ) : null}
    </div>
  );
}
