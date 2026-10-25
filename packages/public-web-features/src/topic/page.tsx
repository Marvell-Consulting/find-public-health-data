import { GridColumn, GridRow, Tabs } from '@fphd/ui';
import { Link, useLocation, useNavigation } from 'react-router';
import { SearchFilterPane } from '../search/filter-pane.tsx';
import { TopicGeographies } from './geographies.tsx';
import { TopicListing } from './listing.tsx';
import type { loadTopic } from './loader.ts';
import { TopicOverview } from './overview.tsx';

type TopicData = Awaited<ReturnType<typeof loadTopic>>;

export function TopicPage(data: TopicData) {
  const { topic, content, overview } = data;
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
      <nav aria-label="Breadcrumb" className="govuk-breadcrumbs">
        <ol className="govuk-breadcrumbs__list">
          <li className="govuk-breadcrumbs__list-item">
            <Link className="govuk-breadcrumbs__link" to="/">
              Home
            </Link>
          </li>
          <li className="govuk-breadcrumbs__list-item">
            <Link className="govuk-breadcrumbs__link" to="/topics">
              Topics
            </Link>
          </li>
        </ol>
      </nav>
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
            content: overview ? (
              <TopicOverview topic={topic} overview={overview} />
            ) : (
              <p className="govuk-body">{topic.description}</p>
            ),
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
                <GridRow>
                  <GridColumn width="one-quarter">
                    <TopicGeographies search={content.search} path={path} tab="areas" />
                  </GridColumn>
                  <GridColumn width="three-quarters">
                    <TopicListing data={tableData} areas />
                  </GridColumn>
                </GridRow>
              ) : (
                <p className="govuk-body">
                  <Link className="govuk-link" to={viewUrl('areas')}>
                    View area summaries for NHS regions
                  </Link>
                </p>
              ),
          },
          {
            id: 'topic-publications',
            param: 'publications',
            label: 'More information',
            content: topic.content ? (
              <div className="fphd-topic-more-information">
                <p className="govuk-body">{topic.content.moreInformation.intro}</p>
                {topic.content.moreInformation.sections.map((section) => (
                  <section key={section.heading}>
                    <h2 className="govuk-heading-m">{section.heading}</h2>
                    <ul className="govuk-list govuk-list--bullet">
                      {section.links.map(({ label, url, note }) => (
                        <li key={url}>
                          <a className="govuk-link" href={url}>
                            {label}
                          </a>
                          {note ? ` (${note})` : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="govuk-body">No further information is available for this topic.</p>
            ),
          },
        ]}
      />
    </div>
  );
}
