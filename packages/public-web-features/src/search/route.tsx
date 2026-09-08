import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { loadSearch } from '../search-loader.js';
import { SearchPage } from '../search-page.js';

export const loader = loadSearch;

export const meta = createDocumentMeta('Search for data');

export function SearchRoute() {
  const data = useLoaderData<typeof loader>();
  return <SearchPage {...data} />;
}

export default SearchRoute;
