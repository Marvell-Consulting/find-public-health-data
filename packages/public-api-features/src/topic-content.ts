import { topicContentSchema } from './contract.ts';

/** Reviewed editorial copy and links served with public topic detail. */
const content = {
  diabetes: {
    overviewIntro:
      'Diabetes is one of the most common long-term conditions. More than 3 million people in England have it. Managing and monitoring it well can reduce illness and early death.',
    highlightedIndicatorIds: [241, 93995, 94262, 94273],
    highlightIntro: 'Highlighted indicators give headline information about:',
    highlightPoints: ['prevalence (number of cases)', 'health service activity', 'health outcomes'],
    moreInformation: {
      intro:
        'Find official statistics releases and statistical commentaries about diabetes data published on GOV.UK.',
      sections: [
        {
          heading: 'Official statistics releases on GOV.UK',
          links: [
            {
              label: 'Diabetes official statistical release, April 2026',
              url: 'https://www.gov.uk/government/statistics/diabetes-profile-update-april-2026',
            },
            {
              label: 'Diabetes official statistical release, March 2025',
              url: 'https://www.gov.uk/government/statistics/diabetes-profile-update-march-2025',
            },
          ],
        },
        {
          heading: 'Other information on GOV.UK',
          links: [
            {
              label: 'Diabetes on GOV.UK',
              url: 'https://www.gov.uk/health-and-social-care/diabetes',
            },
          ],
        },
        {
          heading: 'Other reports and supporting information',
          links: [
            {
              label: 'Health of the region explorer',
              url: 'https://app.powerbi.com/view?r=eyJrIjoiZDkwZGU1MzctNDRhOC00NDVlLTk0ODEtNjQwOGVhMGExY2YyIiwidCI6ImVlNGUxNDk5LTRhMzUtNGIyZS1hZDQ3LTVmM2NmOWRlODY2NiIsImMiOjh9',
              note: 'Power BI dashboard, May 2026',
            },
          ],
        },
      ],
    },
  },
} as const;

export function contentForTopic(slug: string) {
  const entry = content[slug as keyof typeof content];
  return entry ? topicContentSchema.parse(entry) : null;
}
