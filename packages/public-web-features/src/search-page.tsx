import { GridColumn, GridRow } from '@fphd/ui';
import { useRef } from 'react';
import { useLocation } from 'react-router';
import { SearchFilterPane } from './search-filter-pane.js';
import type { loadSearch } from './search-loader.js';
import { SearchResults } from './search-results.js';
import type { SearchState } from './search-url.js';

type SearchData = Awaited<ReturnType<typeof loadSearch>>;

function stateFrom(data: SearchData): SearchState {
  return {
    q: data.q,
    topics: data.topics,
    indicatorTypes: data.indicatorTypes,
    riskFactors: data.riskFactors,
    frameworks: data.frameworks,
    populations: data.populations,
    inequalities: data.inequalities,
    sources: data.sources,
    valueTypes: data.valueTypes,
    yearTypes: data.yearTypes,
    geoLevels: data.geoLevels,
    gaCodes: data.gaCodes,
  };
}

export function SearchPage(data: SearchData) {
  const location = useLocation();
  const prevKey = useRef(location.key);
  const stateRef = useRef<SearchState>(stateFrom(data));
  if (prevKey.current !== location.key) {
    prevKey.current = location.key;
    stateRef.current = stateFrom(data);
  }
  const state = stateFrom(data);

  return (
    <div className="fphd-wide-layout">
      <GridRow>
        <GridColumn width="full">
          <h1 className="govuk-heading-xl govuk-!-margin-bottom-4">Search for data</h1>
        </GridColumn>
      </GridRow>
      <GridRow>
        <GridColumn width="one-third">
          <SearchFilterPane
            displayGroups={data.displayGroups}
            facets={data.facets}
            gaAreaNames={data.gaAreaNames}
            state={state}
          />
        </GridColumn>
        <GridColumn width="two-thirds">
          <SearchResults gaCodes={state.gaCodes} searchResult={data.searchResult} />
        </GridColumn>
      </GridRow>
    </div>
  );
}
