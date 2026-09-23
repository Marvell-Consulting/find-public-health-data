/** A request's query string as its page sees it: without `_routes`, which only a data request carries. */
export function pageSearch(url: URL): string {
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('_routes');
  const search = searchParams.toString();

  return search === '' ? '' : `?${search}`;
}
