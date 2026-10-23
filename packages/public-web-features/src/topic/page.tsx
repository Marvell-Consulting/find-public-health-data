import { CollapsibleFilterCard, GridColumn, GridRow, Tabs } from '@fphd/ui';
import { Link, useLocation, useNavigation } from 'react-router';
import { SearchFilterPane } from '../search/filter-pane.tsx';
import { TopicListing } from './listing.tsx';
import type { loadTopic } from './loader.ts';

type TopicData = Awaited<ReturnType<typeof loadTopic>>;

export function TopicPage(data: TopicData) {
  const { topic, content } = data;
  const tableData = content ? { topic, ...content } : null;
  const path = `/topics/${topic.slug}`;
  const location = useLocation();
  const viewUrl = (tab: string) => {
    const params = new URLSearchParams(location.search);
    params.set('tab-topic', tab);
    return `${path}?${params}`;
  };
  const navigation = useNavigation();
  return (
    <div className="fphd-wide-layout fphd-topic-page">
      <h1 className="govuk-heading-xl">{topic.title}</h1>
      <p className="govuk-visually-hidden" role="status">
        {navigation.state === 'loading' ? 'Loading topic data…' : ''}
      </p>
      <Tabs
        waitForNavigation
        paramKey="tab-topic"
        title={`${topic.title} contents`}
        items={[
          {
            id: 'topic-overview',
            param: 'overview',
            label: 'Overview',
            content: <p className="govuk-body fphd-topic-overview">{topic.description}</p>,
          },
          {
            id: 'topic-data',
            param: 'data',
            label: 'Data',
            content:
              content && tableData ? (
                <GridRow className="fphd-topic-data">
                  <GridColumn width="one-quarter">
                    <SearchFilterPane
                      action={path}
                      extraParams={{ 'tab-topic': 'data', sort: content.listing.sort }}
                      includeTopics={false}
                      includeDataPeriod
                      additionalFilters={
                        <CollapsibleFilterCard active={false} title="Status">
                          <p className="govuk-body-s">
                            Indicator status information will be added here.
                          </p>
                        </CollapsibleFilterCard>
                      }
                      facets={content.search.facets}
                      displayGroups={content.search.displayGroups}
                      gaAreaNames={content.search.gaAreaNames}
                      geographyOptions={content.search.geographyOptions}
                      areasLimited={content.search.areasLimited}
                      state={content.search}
                    />
                  </GridColumn>
                  <GridColumn width="three-quarters">
                    <TopicListing data={tableData} />
                  </GridColumn>
                </GridRow>
              ) : (
                <p className="govuk-body">
                  <Link className="govuk-link" to={viewUrl('data')}>
                    View topic data
                  </Link>
                </p>
              ),
          },
          {
            id: 'topic-area-summaries',
            param: 'areas',
            label: 'Area summaries',
            content:
              content &&
              tableData &&
              (content.defaultAreas ||
                content.search.gaCodes.length > 0 ||
                content.search.geoLevels.length > 0) ? (
                <TopicListing data={tableData} areas />
              ) : (
                <p className="govuk-body">
                  <Link className="govuk-link" to={viewUrl('areas')}>
                    View area summaries for local authorities
                  </Link>
                </p>
              ),
          },
          {
            id: 'topic-publications',
            param: 'publications',
            label: 'Publications',
            content: <p className="govuk-body">Publications for this topic will be added here.</p>,
          },
        ]}
      />
    </div>
  );
}
