export interface SearchState {
  q: string;
  topics: string[];
  indicatorTypes: string[];
  riskFactors: string[];
  frameworks: string[];
  populations: string[];
  inequalities: string[];
  sources: string[];
  valueTypes: string[];
  yearTypes: string[];
  geoLevels: string[];
  gaCodes: string[];
}

export interface DimensionConfig {
  param: string;
  stateKey: keyof SearchState;
  selectedLabel: string;
  autocompleteLabel: string;
  addButtonLabel: string;
  noResultsMessage: string;
  classificationDimension?: string;
  isTopicDimension?: boolean;
  valueIsLabel?: boolean;
}

export const DIMENSIONS: DimensionConfig[] = [
  {
    param: 't',
    stateKey: 'topics',
    selectedLabel: 'Selected topics',
    autocompleteLabel: 'Search for a topic',
    addButtonLabel: 'Add topic',
    noResultsMessage: 'No topics found',
    isTopicDimension: true,
  },
  {
    param: 'it',
    stateKey: 'indicatorTypes',
    selectedLabel: 'Selected indicator types',
    autocompleteLabel: 'Search for an indicator type',
    addButtonLabel: 'Add indicator type',
    noResultsMessage: 'No indicator types found',
    classificationDimension: 'indicator_type',
  },
  {
    param: 'rf',
    stateKey: 'riskFactors',
    selectedLabel: 'Selected risk factors',
    autocompleteLabel: 'Search for a risk factor',
    addButtonLabel: 'Add risk factor',
    noResultsMessage: 'No risk factors found',
    classificationDimension: 'risk_factor',
  },
  {
    param: 'fw',
    stateKey: 'frameworks',
    selectedLabel: 'Selected frameworks',
    autocompleteLabel: 'Search for a framework',
    addButtonLabel: 'Add framework',
    noResultsMessage: 'No frameworks found',
    classificationDimension: 'framework',
  },
  {
    param: 'pg',
    stateKey: 'populations',
    selectedLabel: 'Selected population groups',
    autocompleteLabel: 'Search for a population group',
    addButtonLabel: 'Add population group',
    noResultsMessage: 'No population groups found',
    classificationDimension: 'population',
  },
  {
    param: 'eq',
    stateKey: 'inequalities',
    selectedLabel: 'Selected inequality categories',
    autocompleteLabel: 'Search for an inequality category',
    addButtonLabel: 'Add inequality category',
    noResultsMessage: 'No inequality categories found',
    classificationDimension: 'inequality',
  },
  {
    param: 'src',
    stateKey: 'sources',
    selectedLabel: 'Selected data sources',
    autocompleteLabel: 'Search for a data source',
    addButtonLabel: 'Add data source',
    noResultsMessage: 'No data sources found',
    valueIsLabel: true,
  },
  {
    param: 'vt',
    stateKey: 'valueTypes',
    selectedLabel: 'Selected value types',
    autocompleteLabel: 'Search for a value type',
    addButtonLabel: 'Add value type',
    noResultsMessage: 'No value types found',
    valueIsLabel: true,
  },
  {
    param: 'per',
    stateKey: 'yearTypes',
    selectedLabel: 'Selected reporting periods',
    autocompleteLabel: 'Search for a reporting period',
    addButtonLabel: 'Add reporting period',
    noResultsMessage: 'No reporting periods found',
    valueIsLabel: true,
  },
];

/**
 * Every list-valued param, in URL order: the nine filter dimensions plus the two geography
 * ones, which have no autocomplete of their own and so are absent from DIMENSIONS. Deriving
 * both the URL and the hidden form fields from this keeps a new dimension to a single edit.
 */
export const LIST_PARAMS: { param: string; stateKey: keyof SearchState }[] = [
  ...DIMENSIONS.map(({ param, stateKey }) => ({ param, stateKey })),
  { param: 'geo', stateKey: 'geoLevels' },
  { param: 'ga', stateKey: 'gaCodes' },
];

export function searchUrl(state: SearchState): string {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const { param, stateKey } of LIST_PARAMS) {
    for (const v of state[stateKey] as string[]) p.append(param, v);
  }
  const s = p.toString();
  return `/search${s ? `?${s}` : ''}`;
}

export const EMPTY_SEARCH_STATE: SearchState = {
  q: '',
  topics: [],
  indicatorTypes: [],
  riskFactors: [],
  frameworks: [],
  populations: [],
  inequalities: [],
  sources: [],
  valueTypes: [],
  yearTypes: [],
  geoLevels: [],
  gaCodes: [],
};

export function removeFrom(state: SearchState, key: keyof SearchState, value: string): SearchState {
  const list = state[key] as string[];
  return { ...state, [key]: list.filter((v) => v !== value) };
}
