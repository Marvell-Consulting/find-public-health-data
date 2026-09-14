import {
  Autocomplete,
  type AutocompleteOption,
  Button,
  CollapsibleFilterCard,
  FilterChip,
  FilterChips,
  SearchField,
} from '@fphd/ui';
import { useState } from 'react';
import { Form, Link, useLocation, useNavigate } from 'react-router';
import type { GeographyOptions } from '../geography/loader.js';
import { MAX_SELECTED_AREAS } from '../selection-limits.js';
import { SearchGeographyPicker } from './geography-picker.js';
import type { IndicatorFacets } from './loader.js';
import {
  DIMENSIONS,
  EMPTY_SEARCH_STATE,
  LIST_PARAMS,
  removeFrom,
  type SearchState,
  searchUrl,
} from './url.js';

interface SearchFilterPaneProps {
  state: SearchState;
  facets: IndicatorFacets;
  displayGroups: string[];
  gaAreaNames: Record<string, string>;
  geographyOptions?: GeographyOptions | undefined;
  areasLimited?: boolean | undefined;
}

function HiddenFilters({ state, except }: { state: SearchState; except?: keyof SearchState }) {
  return (
    <>
      {except !== 'q' && state.q ? <input name="q" type="hidden" value={state.q} /> : null}
      {LIST_PARAMS.filter(({ stateKey }) => stateKey !== except).map(({ param, stateKey }) =>
        (state[stateKey] as string[]).map((v) => (
          <input key={`${param}-${v}`} name={param} type="hidden" value={v} />
        )),
      )}
    </>
  );
}

interface FilterDimensionBodyProps {
  state: SearchState;
  stateKey: keyof SearchState;
  selectedLabel: string;
  selected: string[];
  facetLabelOf: (value: string) => string;
  isTopicDimension?: boolean | undefined;
}

function FilterDimensionBody({
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
                onRemove={searchUrl(removeFrom(state, stateKey, v))}
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
  param: string;
  autocompleteLabel: string;
  addButtonLabel: string;
  noResultsMessage: string;
  options: AutocompleteOption[];
  onAdd: (value: string) => void;
  state: SearchState;
}

function FilterDimensionFooter({
  param,
  autocompleteLabel,
  addButtonLabel,
  noResultsMessage,
  options,
  onAdd,
  state,
}: FilterDimensionFooterProps) {
  const [pending, setPending] = useState<AutocompleteOption | null>(null);

  return (
    <div className="fphd-search-dimension govuk-!-margin-bottom-3">
      <Form action="/search" method="get" replace preventScrollReset>
        <HiddenFilters state={state} />
        <Autocomplete
          label={autocompleteLabel}
          name={`${param}-add`}
          noResultsMessage={noResultsMessage}
          options={options}
          onSelect={(opt) => setPending(opt)}
          onInputChange={() => setPending(null)}
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

export function SearchFilterPane({
  state,
  facets,
  displayGroups,
  gaAreaNames,
  geographyOptions,
  areasLimited,
}: SearchFilterPaneProps) {
  const navigate = useNavigate();
  const location = useLocation();

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

  const clearTopicsUrl = searchUrl({ ...state, topics: [], indicatorTypes: [], riskFactors: [] });
  const clearGeoUrl = searchUrl({ ...state, geoLevels: [], gaCodes: [] });
  const clearFwUrl = searchUrl({ ...state, frameworks: [] });
  const clearPopUrl = searchUrl({ ...state, populations: [], inequalities: [] });
  const clearDataAttrUrl = searchUrl({ ...state, sources: [], valueTypes: [], yearTypes: [] });
  const clearAllFiltersUrl = searchUrl({ ...EMPTY_SEARCH_STATE, q: state.q });
  const clearQUrl = searchUrl({ ...state, q: '' });

  const topicsAndTypesDims = DIMENSIONS.filter((d) => ['t', 'it', 'rf'].includes(d.param));
  const fwDims = DIMENSIONS.filter((d) => d.param === 'fw');
  const popDims = DIMENSIONS.filter((d) => ['pg', 'eq'].includes(d.param));
  const dataDims = DIMENSIONS.filter((d) => ['src', 'vt', 'per'].includes(d.param));

  const renderDimensionBody = (dim: (typeof DIMENSIONS)[number]) => (
    <FilterDimensionBody
      key={dim.param}
      facetLabelOf={(v) => labelOf(dim, v)}
      isTopicDimension={dim.isTopicDimension}
      selected={state[dim.stateKey] as string[]}
      selectedLabel={dim.selectedLabel}
      state={state}
      stateKey={dim.stateKey}
    />
  );

  const renderDimensionFooter = (dim: (typeof DIMENSIONS)[number]) => (
    <FilterDimensionFooter
      key={`${dim.param}-${location.key}`}
      addButtonLabel={dim.addButtonLabel}
      autocompleteLabel={dim.autocompleteLabel}
      noResultsMessage={dim.noResultsMessage}
      onAdd={(v) => addToList(dim.stateKey, v)}
      options={optionsForDimension(dim).filter(
        (o) => !(state[dim.stateKey] as string[]).includes(o.value),
      )}
      param={dim.param}
      state={state}
    />
  );

  return (
    <>
      <Form action="/search" method="get" replace>
        <HiddenFilters except="q" state={state} />
        <div className="govuk-!-margin-top-4">
          <SearchField
            key={location.key}
            action={
              <Link className="govuk-link govuk-body-s" preventScrollReset replace to={clearQUrl}>
                Clear search
              </Link>
            }
            defaultValue={state.q}
            id="search-q"
            label="Search by keywords"
            name="q"
          />
        </div>
      </Form>

      <div className="fphd-search-bar__filters-row">
        <h2 className="govuk-heading-m govuk-!-margin-bottom-0">Filters</h2>
        <Link
          className="govuk-link govuk-body-s"
          preventScrollReset
          replace
          to={clearAllFiltersUrl}
        >
          Clear all filters
        </Link>
      </div>

      <CollapsibleFilterCard
        active={topicsActive}
        footer={topicsAndTypesDims.map(renderDimensionFooter)}
        onClear={clearTopicsUrl}
        title="Topics and types"
      >
        {topicsAndTypesDims.map(renderDimensionBody)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={geoActive || Boolean(geographyOptions?.query || geographyOptions?.level)}
        footer={
          <SearchGeographyPicker
            key={location.key}
            state={state}
            displayGroups={displayGroups}
            geographyOptions={geographyOptions}
            onApply={nav}
          />
        }
        onClear={clearGeoUrl}
        title="Geography"
      >
        {areasLimited ? (
          <p className="govuk-body-s">
            You can select up to {MAX_SELECTED_AREAS} areas. Only the first {MAX_SELECTED_AREAS}{' '}
            have been selected.
          </p>
        ) : null}
        <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">
          Selected geographies
        </p>
        {state.geoLevels.length === 0 && state.gaCodes.length === 0 ? (
          <div className="fphd-filter-chips fphd-filter-chips--inline govuk-!-margin-bottom-4">
            <p className="govuk-body-s govuk-!-margin-bottom-0">None selected</p>
          </div>
        ) : (
          <FilterChips className="govuk-!-margin-bottom-4">
            {state.geoLevels.map((level) => (
              <FilterChip
                key={level}
                onRemove={searchUrl(removeFrom(state, 'geoLevels', level))}
                removeLabel={level}
                replace
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
                replace
                value={code}
              >
                {gaAreaNames[code] ?? code}
              </FilterChip>
            ))}
          </FilterChips>
        )}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={fwActive}
        footer={fwDims.map(renderDimensionFooter)}
        hint="Established frameworks used to group or report indicators."
        onClear={clearFwUrl}
        title="Frameworks"
      >
        {fwDims.map(renderDimensionBody)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={popActive}
        footer={popDims.map(renderDimensionFooter)}
        onClear={clearPopUrl}
        title="Populations and inequalities"
      >
        {popDims.map(renderDimensionBody)}
      </CollapsibleFilterCard>

      <CollapsibleFilterCard
        active={dataAttrActive}
        footer={dataDims.map(renderDimensionFooter)}
        onClear={clearDataAttrUrl}
        title="Data attributes"
      >
        {dataDims.map(renderDimensionBody)}
      </CollapsibleFilterCard>
    </>
  );
}
