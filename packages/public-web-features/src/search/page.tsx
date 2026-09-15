import { GridColumn, GridRow } from '@fphd/ui';
import { useLocation } from 'react-router';
import { SearchFilterPane } from './filter-pane.js';
import type { loadSearch } from './loader.js';
import { SearchResults } from './results.js';
import type { SearchState } from './url.js';

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
  const location = useLocation();

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
            geographyOptions={data.geographyOptions}
            areasLimited={data.areasLimited}
            state={state}
          />
        </GridColumn>
        <GridColumn width="two-thirds">
          <SearchResults
            navigationKey={location.key}
            gaCodes={state.gaCodes}
            geoLevels={state.geoLevels}
            searchResult={data.searchResult}
          />
        </GridColumn>
      </GridRow>
    </div>
  );
}
