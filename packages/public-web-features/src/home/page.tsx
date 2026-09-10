import { CardList, GridColumn, GridRow, InsetText } from '@fphd/ui';

const findDataCards = [
  {
    description: 'Browse data grouped by health topics',
    href: '/topics',
    title: 'Browse by topics',
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
        <CardList items={findDataCards} />
      </GridColumn>
    </GridRow>
  );
}
