import { A, GridColumn, GridRow, InsetText, SearchBox, SectionBreak } from '@fphd/ui';

interface TopicSummary {
  change: string;
  description: string;
  link: string;
  name: string;
  unit?: string;
  value: string;
}

interface ReleaseIndicatorGroup {
  introduction: string;
  indicators: string[];
}

const topicSummaries = [
  {
    name: 'Life expectancy',
    description: 'Life expectancy at birth, all ages, males',
    value: '80.0',
    unit: 'years old',
    change: 'in 2025, up 0.3% from 2024',
    link: 'See more life expectancy indicators',
  },
  {
    name: 'Mental health and wellbeing',
    description: 'Prevalence of high anxiety, people aged 16 years and over',
    value: '83.2',
    unit: 'years old',
    change: 'in 2023, up 7.4% from 2012',
    link: 'See more mental health and wellbeing indicators',
  },
  {
    name: 'Smoking',
    description: 'Smoking prevalence, people aged 18 years and over',
    value: '10.4%',
    change: 'in 2024, down 9.4% from 2011',
    link: 'See more smoking indicators',
  },
  {
    name: 'Alcohol',
    description: 'Hospital admissions for alcohol-related conditions',
    value: '504',
    unit: 'per 100,000 people',
    change: 'in 2023/24, up 12 from 2016/17',
    link: 'See more alcohol indicators',
  },
  {
    name: 'Obesity',
    description: 'Obesity in Year 6 children, people aged 10–11 years',
    value: '22.2%',
    change: 'in 2024/25, up 4.7% from 2006/07',
    link: 'See more obesity indicators',
  },
  {
    name: 'Cancer',
    description: 'Deaths from cancer considered preventable, people aged under 75',
    value: '47.4',
    unit: 'every 100,000 people',
    change: 'in 2024, down 33.4 from 2001',
    link: 'See more cancer indicators',
  },
] satisfies TopicSummary[];

const latestRelease = {
  title: 'October 2025 indicator updates',
  date: '14 October 2025',
  indicatorGroups: [
    {
      introduction: 'We have published new indicators:',
      indicators: ['Indicator name', 'Indicator name'],
    },
    {
      introduction: 'We have also added new data for the following indicators:',
      indicators: ['Indicator name', 'Indicator name'],
    },
  ],
} satisfies {
  date: string;
  indicatorGroups: ReleaseIndicatorGroup[];
  title: string;
};

function rowsOf<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function IndicatorSearch() {
  return (
    <search>
      <form method="get" action="/indicators">
        <div aria-hidden="true" className="fphd-search-heading">
          Search for indicators
        </div>
        <SearchBox
          autoComplete="off"
          className="fphd-search-bar"
          id="search-subject"
          label=""
          name="searchSubject"
          type="search"
          aria-label="Search for indicators"
        />
      </form>
    </search>
  );
}

function ServiceIntroduction() {
  return (
    <GridRow>
      <GridColumn width="two-thirds">
        <h1 className="govuk-heading-xl">Find public health data</h1>
        <p className="govuk-body">
          This service contains data in the form of health indicators. Indicators provide a measure
          of a particular aspect of health, such as life expectancy, mortality rates and disease
          prevalence. They can help measure, monitor and evaluate the health status of a population.
        </p>
        <p className="govuk-body">
          The indicators in this service cover England, and areas within England, only.
        </p>
        <InsetText>This service was previously known as Fingertips.</InsetText>
        <p className="govuk-body">You can:</p>
        <ul className="govuk-list govuk-list--bullet">
          <li>
            search for indicators by keywords, such as "life expectancy" or "diabetes prevalence"
          </li>
          <li>
            <A href="/topics">browse a list of topics</A>
          </li>
          <li>
            <A href="/indicators">see all indicators</A>
          </li>
          <li>
            filter your search results, including by geographic area, topic and indicator type
          </li>
        </ul>
        <IndicatorSearch />
      </GridColumn>
    </GridRow>
  );
}

function TopicSummaryCard({ summary }: { summary: TopicSummary }) {
  return (
    <GridColumn width="one-third">
      <h3 className="govuk-heading-s fphd-topic-heading">{summary.name}</h3>
      <div className="fphd-stat-card">
        <p className="govuk-body-s fphd-stat-card__description">{summary.description}</p>
        <div className="fphd-stat">
          <span className="fphd-stat__number">{summary.value}</span>
          {summary.unit ? <span className="fphd-stat__unit">{summary.unit}</span> : null}
        </div>
        <p className="govuk-body-s fphd-stat-card__change">
          <strong>{summary.change}</strong>
        </p>
        <A className="govuk-body-s fphd-stat-card__link" href="/indicators">
          {summary.link}
        </A>
      </div>
    </GridColumn>
  );
}

function TopicSummaries() {
  return (
    <>
      <h2 className="govuk-heading-l">Topic summaries for England</h2>
      {rowsOf(topicSummaries, 3).map((row) => (
        <GridRow key={row[0]?.name}>
          {row.map((summary) => (
            <TopicSummaryCard summary={summary} key={summary.name} />
          ))}
        </GridRow>
      ))}
      <p className="govuk-body">
        <A className="fphd-show-more" href="/topics">
          <svg
            className="fphd-show-more__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 320 512"
            width="12"
            height="12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"
            />
          </svg>
          Show more
        </A>
      </p>
    </>
  );
}

function IndicatorGroup({ indicators, introduction }: ReleaseIndicatorGroup) {
  return (
    <>
      <p className="govuk-body">{introduction}</p>
      <ul className="govuk-list govuk-list--bullet">
        {indicators.map((indicator, index) => (
          <li key={`${indicator}-${index}`}>{indicator}</li>
        ))}
      </ul>
    </>
  );
}

function LatestRelease() {
  return (
    <GridRow>
      <GridColumn width="two-thirds">
        <h2 className="govuk-heading-l">Latest release</h2>
        <p className="govuk-body">
          <strong>{latestRelease.title}</strong>
          <br />
          {latestRelease.date}
        </p>
        {latestRelease.indicatorGroups.map((group) => (
          <IndicatorGroup {...group} key={group.introduction} />
        ))}
        <p className="govuk-body">
          You can <A href="/releases">see all previous releases.</A>
        </p>
      </GridColumn>
    </GridRow>
  );
}

export function PublicHomePage() {
  return (
    <>
      <ServiceIntroduction />
      <SectionBreak size="m" visible />
      <TopicSummaries />
      <SectionBreak size="l" visible />
      <LatestRelease />
    </>
  );
}
