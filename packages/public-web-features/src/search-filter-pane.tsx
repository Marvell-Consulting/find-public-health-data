import {
  Autocomplete,
  type AutocompleteOption,
  Button,
  CollapsibleFilterCard,
  FilterChip,
  FilterChips,
  GeographyTree,
} from '@fphd/ui';
import { useState } from 'react';
import { Form, Link, useNavigate } from 'react-router';

import type { IndicatorFacets } from './search-loader.js';
import { DIMENSIONS, removeFrom, type SearchState, searchUrl } from './search-url.js';

interface SearchFilterPaneProps {
  state: SearchState;
  facets: IndicatorFacets;
  displayGroups: string[];
  gaAreaNames: Record<string, string>;
}

function HiddenFilters({ state, except }: { state: SearchState; except?: keyof SearchState }) {
  return (
    <>
      {except !== 'q' && state.q ? <input name="q" type="hidden" value={state.q} /> : null}
      {except !== 'topics' &&
        state.topics.map((v) => <input key={v} name="t" type="hidden" value={v} />)}
      {except !== 'indicatorTypes' &&
        state.indicatorTypes.map((v) => <input key={v} name="it" type="hidden" value={v} />)}
      {except !== 'riskFactors' &&
        state.riskFactors.map((v) => <input key={v} name="rf" type="hidden" value={v} />)}
      {except !== 'frameworks' &&
        state.frameworks.map((v) => <input key={v} name="fw" type="hidden" value={v} />)}
      {except !== 'populations' &&
        state.populations.map((v) => <input key={v} name="pg" type="hidden" value={v} />)}
      {except !== 'inequalities' &&
        state.inequalities.map((v) => <input key={v} name="eq" type="hidden" value={v} />)}
      {except !== 'sources' &&
        state.sources.map((v) => <input key={v} name="src" type="hidden" value={v} />)}
      {except !== 'valueTypes' &&
        state.valueTypes.map((v) => <input key={v} name="vt" type="hidden" value={v} />)}
      {except !== 'yearTypes' &&
        state.yearTypes.map((v) => <input key={v} name="per" type="hidden" value={v} />)}
      {except !== 'geoLevels' &&
        state.geoLevels.map((v) => <input key={v} name="geo" type="hidden" value={v} />)}
      {except !== 'gaCodes' &&
        state.gaCodes.map((v) => <input key={v} name="ga" type="hidden" value={v} />)}
    </>
  );
}

interface FilterDimensionProps {
  state: SearchState;
  stateKey: keyof SearchState;
  param: string;
  selectedLabel: string;
  autocompleteLabel: string;
  addButtonLabel: string;
  noResultsMessage: string;
  options: AutocompleteOption[];
  selected: string[];
  facetLabelOf: (value: string) => string;
  onAdd: (value: string) => void;
  isTopicDimension?: boolean | undefined;
}

function FilterDimension({
  state,
  stateKey,
  param,
  selectedLabel,
  autocompleteLabel,
  addButtonLabel,
  noResultsMessage,
  options,
  selected,
  facetLabelOf,
  onAdd,
  isTopicDimension,
}: FilterDimensionProps) {
  const [pending, setPending] = useState<AutocompleteOption | null>(null);
  const available = options.filter((o) => !selected.includes(o.value));

  return (
    <div className="govuk-!-margin-bottom-3">
      <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2">{selectedLabel}</p>
      {selected.length === 0 ? (
        <p className="govuk-body-s govuk-!-margin-bottom-2">None selected</p>
      ) : (
        <FilterChips>
          {selected.map((v) => {
            const chipLabel = facetLabelOf(v);
            return (
              <FilterChip
                key={v}
                onRemove={searchUrl(removeFrom(state, stateKey, v))}
                removeLabel={chipLabel}
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
      <Autocomplete
        label={autocompleteLabel}
        noResultsMessage={noResultsMessage}
        options={available}
        onSelect={(opt) => setPending(opt)}
      />
      <noscript>
        <input className="govuk-input govuk-!-margin-top-2" name={`${param}-add`} type="text" />
      </noscript>
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

export function SearchFilterPane({
  state,
  facets,
  displayGroups,
  gaAreaNames,
}: SearchFilterPaneProps) {
  const navigate = useNavigate();
  const [pendingGa, setPendingGa] = useState<string[]>(state.gaCodes);
  const [pendingGeo, setPendingGeo] = useState<string[]>(state.geoLevels);

  const nav = (next: SearchState) => {
    void navigate(searchUrl(next), { replace: true, preventScrollReset: true });
  };

  const addToList = (key: keyof SearchState, value: string) => {
    const list = state[key] as string[];
    if (list.includes(value)) return;
    nav({ ...state, [key]: [...list, value] });
  };

  const topicLabels = new Map(facets.topics.map((t) => [t.slug, t.title]));
  const classifLabels = new Map(facets.classifications.map((c) => [c.slug, c.name]));

  const optionsForDimension = (dim: (typeof DIMENSIONS)[number]): AutocompleteOption[] => {
    if (dim.isTopicDimension) {
      return facets.topics.map((t) => ({ value: t.slug, label: t.title }));
    }
    if (dim.classificationDimension) {
      return facets.classifications
        .filter((c) => c.dimension === dim.classificationDimension)
        .map((c) => ({ value: c.slug, label: c.name }));
    }
    if (dim.stateKey === 'sources') return facets.sources.map((s) => ({ value: s, label: s }));
    if (dim.stateKey === 'valueTypes')
      return facets.valueTypes.map((v) => ({ value: v, label: v }));
    if (dim.stateKey === 'yearTypes') return facets.yearTypes.map((y) => ({ value: y, label: y }));
    return [];
  };

  const labelOf = (dim: (typeof DIMENSIONS)[number], value: string): string => {
    if (dim.isTopicDimension) return topicLabels.get(value) ?? value;
    if (dim.classificationDimension) return classifLabels.get(value) ?? value;
    return value;
  };

  const topicsActive =
    state.topics.length > 0 || state.indicatorTypes.length > 0 || state.riskFactors.length > 0;
  const geoActive = state.geoLevels.length > 0 || state.gaCodes.length > 0;
  const fwActive = state.frameworks.length > 0;
  const popActive = state.populations.length > 0 || state.inequalities.length > 0;
  const dataAttrActive =
    state.sources.length > 0 || state.valueTypes.length > 0 || state.yearTypes.length > 0;
  const anyFilterActive = topicsActive || geoActive || fwActive || popActive || dataAttrActive;

  const clearTopicsUrl = topicsActive
    ? searchUrl({ ...state, topics: [], indicatorTypes: [], riskFactors: [] })
    : undefined;
  const clearGeoUrl = geoActive ? searchUrl({ ...state, geoLevels: [], gaCodes: [] }) : undefined;
  const clearFwUrl = fwActive ? searchUrl({ ...state, frameworks: [] }) : undefined;
  const clearPopUrl = popActive
    ? searchUrl({ ...state, populations: [], inequalities: [] })
    : undefined;
  const clearDataAttrUrl = dataAttrActive
    ? searchUrl({ ...state, sources: [], valueTypes: [], yearTypes: [] })
    : undefined;
  const clearAllFiltersUrl = anyFilterActive
    ? `/search${state.q ? `?q=${encodeURIComponent(state.q)}` : ''}`
    : undefined;
  const clearQUrl = state.q ? searchUrl({ ...state, q: '' }) : undefined;

  const topicsAndTypesDims = DIMENSIONS.filter((d) => ['t', 'it', 'rf'].includes(d.param));
  const fwDims = DIMENSIONS.filter((d) => d.param === 'fw');
  const popDims = DIMENSIONS.filter((d) => ['pg', 'eq'].includes(d.param));
  const dataDims = DIMENSIONS.filter((d) => ['src', 'vt', 'per'].includes(d.param));

  const renderDimension = (dim: (typeof DIMENSIONS)[number]) => (
    <FilterDimension
      key={dim.param}
      addButtonLabel={dim.addButtonLabel}
      autocompleteLabel={dim.autocompleteLabel}
      facetLabelOf={(v) => labelOf(dim, v)}
      isTopicDimension={dim.isTopicDimension}
      noResultsMessage={dim.noResultsMessage}
      onAdd={(v) => addToList(dim.stateKey, v)}
      options={optionsForDimension(dim)}
      param={dim.param}
      selected={state[dim.stateKey] as string[]}
      selectedLabel={dim.selectedLabel}
      state={state}
      stateKey={dim.stateKey}
    />
  );

  return (
    <>
      <Form action="/search" method="get" replace>
        <HiddenFilters except="q" state={state} />
        <div className="govuk-form-group govuk-!-margin-bottom-2">
          <label className="govuk-label govuk-label--m" htmlFor="search-q">
            Search by keywords
          </label>
          <div style={{ display: 'flex' }}>
            <input
              className="govuk-input"
              defaultValue={state.q}
              id="search-q"
              name="q"
              style={{ flex: 1 }}
              type="search"
            />
            <button
              aria-label="Search"
              className="govuk-button govuk-!-margin-bottom-0"
              type="submit"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                height="20"
                viewBox="0 0 20 20"
                width="20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19.36 17.73l-5.13-5.13A7.49 7.49 0 0 0 7.5 0a7.5 7.5 0 1 0 0 15 7.49 7.49 0 0 0 4.6-1.59l5.13 5.13 2.13-1.81zM7.5 13a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </Form>
      {clearQUrl ? (
        <Link
          className="govuk-link govuk-body-s govuk-!-display-block govuk-!-margin-bottom-4"
          preventScrollReset
          to={clearQUrl}
        >
          Clear search
        </Link>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '16px',
        }}
      >
        <h2 className="govuk-heading-m govuk-!-margin-bottom-0">Filters</h2>
        {clearAllFiltersUrl ? (
          <Link className="govuk-link govuk-body-s" preventScrollReset to={clearAllFiltersUrl}>
            Clear all filters
          </Link>
        ) : null}
      </div>

      <CollapsibleFilterCard
        active={topicsActive}
        onClear={clearTopicsUrl}
        title="Topics and types"
      >
        {topicsAndTypesDims.map(renderDimension)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard active={geoActive} onClear={clearGeoUrl} title="Geography">
        <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2">
          Selected geographies
        </p>
        {state.geoLevels.length === 0 && state.gaCodes.length === 0 ? (
          <p className="govuk-body-s govuk-!-margin-bottom-2">None selected</p>
        ) : (
          <FilterChips>
            {state.geoLevels.map((level) => (
              <FilterChip
                key={level}
                onRemove={searchUrl(removeFrom(state, 'geoLevels', level))}
                removeLabel={level}
                value={level}
              >
                {level}
              </FilterChip>
            ))}
            {state.gaCodes.map((code) => (
              <FilterChip
                key={code}
                onRemove={searchUrl(removeFrom(state, 'gaCodes', code))}
                removeLabel={gaAreaNames[code] ?? code}
                value={code}
              >
                {gaAreaNames[code] ?? code}
              </FilterChip>
            ))}
          </FilterChips>
        )}
        <Form action="/search" method="get">
          <HiddenFilters except="geoLevels" state={state} />
          <GeographyTree
            levelName="geo"
            levels={displayGroups}
            maxAreaTicks={100}
            name="ga"
            onChange={setPendingGa}
            onLevelsChange={setPendingGeo}
            selected={pendingGa}
            selectedLevels={pendingGeo}
          />
          <Button
            className="govuk-!-margin-top-3 govuk-!-margin-bottom-0"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              const levelsChanged =
                pendingGeo.length !== state.geoLevels.length ||
                pendingGeo.some((l) => !state.geoLevels.includes(l));
              if (pendingGa.length === 0 && !levelsChanged) {
                return;
              }
              event.preventDefault();
              setPendingGa([]);
              nav({
                ...state,
                geoLevels: pendingGeo,
                gaCodes: [...new Set([...state.gaCodes, ...pendingGa])].slice(0, 100),
              });
            }}
            type="submit"
          >
            Add selected geographies
            {pendingGa.length > 0 ? ` (${pendingGa.length})` : ''}
          </Button>
        </Form>
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={fwActive}
        hint="Established frameworks used to group or report indicators."
        onClear={clearFwUrl}
        title="Frameworks"
      >
        {fwDims.map(renderDimension)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={popActive}
        onClear={clearPopUrl}
        title="Populations and inequalities"
      >
        {popDims.map(renderDimension)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={dataAttrActive}
        onClear={clearDataAttrUrl}
        title="Data attributes"
      >
        {dataDims.map(renderDimension)}
      </CollapsibleFilterCard>
    </>
  );
}
