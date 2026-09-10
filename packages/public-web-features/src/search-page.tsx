import { GridColumn, GridRow } from '@fphd/ui';
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
  const state = stateFrom(data);

  return (
    <div className="fphd-wide-layout">
      <div className="fphd-results-header">
        <h1 className="govuk-heading-xl govuk-!-margin-bottom-0">Search for data</h1>
      </div>
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
