import {
  indicatorDetailSchema,
  topicDetailSchema,
  topicSummaryListSchema,
  topicTrendSummarySchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { loadIndicatorTableData } from '../indicator/loader.ts';
import { loadSearch } from '../search/loader.ts';
import { TOPIC_AREA_GROUPS, topicIndicators, topicTableSelection } from './data.ts';

export type { TopicDetail, TopicSummary } from '@fphd/public-api-features/contract';

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs.
 */
export async function loadTopics({ context }: LoaderFunctionArgs) {
  return context.get(apiContext).get('/api/topics', topicSummaryListSchema);
}

/**
 * The client turns the API's 404 into a thrown 404 Response, so React Router renders the
 * nearest not-found boundary instead of the page component. It also encodes the slug —
 * React Router decodes %2F inside a single dynamic segment, so an un-encoded slug of
 * '../internal' would normalise the request onto a different API route entirely.
 */
export async function loadTopic(args: LoaderFunctionArgs) {
  const { context, params, request } = args;
  const { slug } = params;

  if (!slug) {
    // `topics/:slug` cannot match without a segment, so reaching here means the route table
    // and this loader have drifted apart — a wiring bug, not a request the user can make.
    throw new Error('loadTopic expects a slug param; check the route that renders it');
  }

  const topic = await context.get(apiContext).get(apiPath`/api/topics/${slug}`, topicDetailSchema);
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab-topic');
  const path = `/topics/${encodeURIComponent(slug)}`;
  if (tab === null || tab === 'overview') {
    const [search, trends] = await Promise.all([
      loadSearch(args, { topicSlug: slug, path }),
      context.get(apiContext).get(apiPath`/api/topics/${slug}/trends`, topicTrendSummarySchema),
    ]);
    search.gaCodes = search.gaCodes.slice(0, 1);
    search.geoLevels = [];
    const preferred = topic.content?.highlightedIndicatorIds ?? [];
    const searchIds = search.searchResult.indicators.map(({ shortId }) => shortId);
    const availablePreferred = (
      await Promise.all(
        preferred.map(async (id) => {
          if (searchIds.includes(id)) return id;
          try {
            await context
              .get(apiContext)
              .get(apiPath`/api/indicators/${String(id)}`, indicatorDetailSchema);
            return id;
          } catch (error) {
            if (error instanceof Response && error.status === 404) return null;
            throw error;
          }
        }),
      )
    ).filter((id): id is number => id !== null);
    const highlightIds = [
      ...availablePreferred,
      ...searchIds.filter((id) => !availablePreferred.includes(id)),
    ].slice(0, 4);
    const dataUrl = new URL(request.url);
    dataUrl.search = '';
    for (const id of highlightIds) dataUrl.searchParams.append('is', String(id));
    for (const code of search.gaCodes) dataUrl.searchParams.append('as', code);
    for (const level of search.geoLevels) dataUrl.searchParams.append('als', level);
    const data = highlightIds.length
      ? await loadIndicatorTableData(
          { ...args, params: {}, request: new Request(dataUrl) },
          search.displayGroups,
        )
      : null;
    return {
      topic,
      content: null,
      overview: { search, trends, selected: data ? topicTableSelection(data.selected) : [] },
    };
  }
  if (tab !== 'data' && tab !== 'areas') return { topic, content: null, overview: null };
  const summaryGroup = TOPIC_AREA_GROUPS.includes(url.searchParams.get('geo') ?? '')
    ? (url.searchParams.get('geo') ?? 'NHS regions')
    : 'NHS regions';
  const search = await loadSearch(args, {
    topicSlug: slug,
    path,
    ...(tab === 'areas' ? { geographyGroup: summaryGroup } : {}),
  });
  const listing = topicIndicators(
    search.searchResult.indicators,
    url.searchParams,
    search.searchResult,
  );
  const dataUrl = new URL(request.url);
  dataUrl.search = '';
  for (const { shortId } of listing.indicators) dataUrl.searchParams.append('is', String(shortId));
  for (const code of search.gaCodes) dataUrl.searchParams.append('as', code);
  if (tab !== 'areas' || search.gaCodes.length === 0) {
    for (const level of search.geoLevels) dataUrl.searchParams.append('als', level);
  }
  const defaultAreas =
    url.searchParams.get('tab-topic') === 'areas' &&
    url.searchParams.getAll('ga').length === 0 &&
    url.searchParams.getAll('geo').length === 0;
  const data = await loadIndicatorTableData(
    {
      ...args,
      params: {},
      request: new Request(dataUrl),
    },
    search.displayGroups,
    tab === 'areas',
  );
  if (tab === 'areas')
    search.geographyOptions = {
      ...search.geographyOptions,
      previews: [
        { name: summaryGroup, areas: data.selectedAreas.map(({ code, name }) => ({ code, name })) },
      ],
    };
  return {
    topic,
    overview: null,
    content: {
      search,
      listing,
      data: { ...data, selected: topicTableSelection(data.selected) },
      defaultAreas,
    },
  };
}
