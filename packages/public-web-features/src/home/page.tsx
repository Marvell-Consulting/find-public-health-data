import { CardList, GridColumn, GridRow, InsetText } from '@fphd/ui';

const findDataCards = [
  {
    description: 'Browse data grouped by health topics',
    href: '/topics',
    title: 'Browse by topics',
  },
  {
    description: 'Browse and filter all data, including by geographic area',
    href: '/search',
    title: 'See all data',
  },
];

export function PublicHomePage() {
  return (
    <GridRow>
      <GridColumn width="two-thirds">
        <h1 className="govuk-heading-xl">Find public health data</h1>

        <h2 className="govuk-heading-l">Public health data</h2>
        <p className="govuk-body">Public health data:</p>
        <ul className="govuk-list govuk-list--bullet">
          <li>
            is used to protect and improve the health of local, regional and national communities
            and populations
          </li>
          <li>does not include individual-level data</li>
          <li>
            can focus on the impact of inequalities in health, including age, gender and deprivation
          </li>
          <li>covers both medical and non-medical factors that influence health</li>
        </ul>

        <h2 className="govuk-heading-l">Using this service</h2>
        <p className="govuk-body">
          Anyone with an interest in public health data can use this service. You will find data in
          the form of <strong>indicators</strong> – measures of a particular aspect of health, such
          as life expectancy or hospital admission rates.
        </p>
        <p className="govuk-body">
          The data in this service covers England, and areas within England, only.
        </p>
        <InsetText>This service was previously known as Fingertips.</InsetText>

        <h2 className="govuk-heading-l">Find data</h2>
        <form action="/search" method="get">
          <div className="govuk-form-group fphd-search-bar govuk-!-margin-bottom-4">
            <label className="govuk-label govuk-label--m" htmlFor="home-search-q">
              Search for data
            </label>
            <div style={{ display: 'flex' }}>
              <input
                autoComplete="off"
                className="govuk-input"
                id="home-search-q"
                name="q"
                style={{ flex: 1 }}
                type="search"
              />
              <button
                aria-label="Search"
                className="govuk-button govuk-!-margin-bottom-0"
                type="submit"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  height="20"
                  viewBox="0 0 20 20"
                  width="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.36 17.73l-5.13-5.13A7.49 7.49 0 0 0 7.5 0a7.5 7.5 0 1 0 0 15 7.49 7.49 0 0 0 4.6-1.59l5.13 5.13 2.13-1.81zM7.5 13a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </form>
        <CardList items={findDataCards} />
      </GridColumn>
    </GridRow>
  );
}
