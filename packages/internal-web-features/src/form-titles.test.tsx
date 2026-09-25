import { createDocumentMeta, serviceName } from '@fphd/ui';
import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoutesStub, Meta, type MetaFunction, Outlet } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FORM_NOT_SAVED } from './form-refusal.ts';
import * as calculation from './indicator-calculation/route.tsx';
import * as confidenceIntervals from './indicator-confidence-intervals/route.tsx';
import * as definitionAndRationale from './indicator-definition-and-rationale/route.tsx';
import * as links from './indicator-links/route.tsx';
import * as editIndicatorName from './indicator-name/edit-route.tsx';
import * as newIndicator from './indicator-name/new-route.tsx';
import * as otherNotesAndCaveats from './indicator-other-notes-and-caveats/route.tsx';
import * as polarity from './indicator-polarity/route.tsx';
import * as publishingDate from './indicator-publishing-date/route.tsx';
import * as sexAndAges from './indicator-sex-and-ages/route.tsx';
import * as updateFrequency from './indicator-update-frequency/route.tsx';
import * as editTopic from './topic-admin/edit-route.tsx';
import * as newTopic from './topic-admin/new-route.tsx';

interface FormRoute {
  default: ComponentType;
  meta: MetaFunction;
}

const indicator = {
  id: '00000000-0000-7000-8000-000000000001',
  shortId: 90366,
  name: 'Life expectancy at birth',
  publishedSlug: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
  indicatorStatus: 'new',
  draftStatus: 'draft',
};

const topic = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  title: 'Smoking',
  slug: 'smoking',
  description: 'About smoking.',
};

const sexAndAgesUnanswered = {
  sexes: [],
  ageType: '',
  ageRanges: [{ lowerLimit: '', lowerLimitUnit: '', upperLimit: '', upperLimitUnit: '' }],
  specificAge: '',
  specificAgeUnit: '',
  ageOtherDetail: '',
};

const notesAndCaveatsUnanswered = {
  disclosureControl: '',
  disclosureControlDetail: '',
  roundingApplied: '',
  roundingDetail: '',
  caveatsNeeded: '',
  caveatsDetail: '',
  otherNotesNeeded: '',
  otherNotesDetail: '',
};

const publishingDateUnanswered = {
  publishingDateDay: '',
  publishingDateMonth: '',
  publishingDateYear: '',
  publishingTimeHour: '09',
  publishingTimeMinute: '30',
};

const forms: {
  name: string;
  route: FormRoute;
  pageTitle: string;
  loaderData?: unknown;
  rejected: unknown;
}[] = [
  {
    name: 'new indicator',
    route: newIndicator,
    pageTitle: 'What is the name of the indicator?',
    rejected: { values: { name: '' }, fieldErrors: { name: 'Enter the name of the indicator' } },
  },
  {
    name: 'indicator name',
    route: editIndicatorName,
    pageTitle: 'What is the name of the indicator?',
    loaderData: { indicator },
    rejected: { values: { name: '' }, fieldErrors: { name: 'Enter the name of the indicator' } },
  },
  {
    name: 'definition and rationale',
    route: definitionAndRationale,
    pageTitle: 'Definition and rationale',
    loaderData: { id: indicator.id, values: { definition: '', rationale: '' } },
    rejected: {
      values: { definition: '', rationale: '' },
      fieldErrors: { definition: 'Enter the definition of the indicator' },
    },
  },
  {
    name: 'polarity',
    route: polarity,
    pageTitle: 'What is the polarity of this indicator?',
    loaderData: { id: indicator.id, values: { polarity: '' } },
    rejected: {
      values: { polarity: '' },
      fieldErrors: { polarity: 'Select the polarity of the indicator' },
    },
  },
  {
    name: 'calculation',
    route: calculation,
    pageTitle: 'How was the indicator calculated?',
    loaderData: {
      id: indicator.id,
      values: { methodology: '', calculatedBy: '', calculatedByOther: '' },
    },
    rejected: {
      values: { methodology: '', calculatedBy: '', calculatedByOther: '' },
      fieldErrors: { methodology: 'Enter the methodology' },
    },
  },
  {
    name: 'confidence intervals',
    route: confidenceIntervals,
    pageTitle: 'Confidence intervals',
    loaderData: {
      id: indicator.id,
      values: {
        ciMethodId: '',
        ciMethodModified: '',
        ciMethodModifications: '',
        ciMethodOtherDetail: '',
      },
      methods: [],
    },
    rejected: {
      values: {
        ciMethodId: '',
        ciMethodModified: '',
        ciMethodModifications: '',
        ciMethodOtherDetail: '',
      },
      fieldErrors: { ciMethodId: 'Select the confidence interval method used' },
    },
  },
  {
    name: 'update frequency',
    route: updateFrequency,
    pageTitle: 'How often will this indicator be updated?',
    loaderData: { id: indicator.id, values: { updateFrequency: '' } },
    rejected: {
      values: { updateFrequency: '' },
      fieldErrors: { updateFrequency: 'Select how often this indicator will be updated' },
    },
  },
  {
    name: 'other notes and caveats',
    route: otherNotesAndCaveats,
    pageTitle: 'Provide any other notes and caveats',
    loaderData: { id: indicator.id, values: notesAndCaveatsUnanswered },
    rejected: {
      values: notesAndCaveatsUnanswered,
      fieldErrors: { disclosureControl: 'Select whether disclosure control has been applied' },
    },
  },
  {
    name: 'publishing date',
    route: publishingDate,
    pageTitle: 'When should this indicator be published?',
    loaderData: { id: indicator.id, values: publishingDateUnanswered },
    rejected: {
      values: publishingDateUnanswered,
      fieldErrors: { publishingDateDay: 'Enter the publishing date' },
    },
  },
  {
    name: 'links',
    route: links,
    pageTitle: 'Are there any relevant links to help users understand this indicator better?',
    loaderData: {
      id: indicator.id,
      values: { hasLinks: '', links: [], linkUrl: '', linkText: '' },
    },
    rejected: {
      values: { hasLinks: '', links: [], linkUrl: '', linkText: '' },
      fieldErrors: { hasLinks: 'Select whether there are any relevant links' },
    },
  },
  {
    name: 'sex and ages',
    route: sexAndAges,
    pageTitle: 'What are the sexes and ages included in this indicator?',
    loaderData: { id: indicator.id, values: sexAndAgesUnanswered },
    rejected: {
      values: sexAndAgesUnanswered,
      fieldErrors: { sexes: 'Select sexes included', ageType: 'Select the age type' },
    },
  },
  {
    name: 'new topic',
    route: newTopic,
    pageTitle: 'Add a topic',
    rejected: { values: topic, fieldErrors: { slug: 'This slug is already used' } },
  },
  {
    name: 'edit topic',
    route: editTopic,
    pageTitle: 'Edit topic',
    loaderData: { topic },
    rejected: { values: topic, fieldErrors: { slug: 'This slug is already used' } },
  },
];

// Server-renders the document as a no-JavaScript POST gets it, under a root titled as the apps' are.
function renderDocument({ route, loaderData }: (typeof forms)[number], actionData?: unknown) {
  const Routes = createRoutesStub([
    {
      id: 'root',
      path: '/',
      meta: createDocumentMeta(),
      Component: () => (
        <html lang="en">
          <head>
            <Meta />
          </head>
          <body>
            <Outlet />
          </body>
        </html>
      ),
      children: [
        {
          id: 'form',
          path: 'form',
          meta: route.meta,
          Component: route.default,
          action: () => null,
          ...(loaderData === undefined ? {} : { loader: () => loaderData }),
        },
      ],
    },
  ]);

  return renderToString(
    <Routes
      hydrationData={{
        loaderData: loaderData === undefined ? {} : { form: loaderData },
        actionData: actionData === undefined ? null : { form: actionData },
      }}
      initialEntries={['/form']}
    />,
  );
}

function titlesIn(html: string) {
  return [...html.matchAll(/<title>(.*?)<\/title>/g)].map(([, title]) => title);
}

describe.each(forms)('the $name form', (form) => {
  it('server-renders one title, named after the page', () => {
    expect(titlesIn(renderDocument(form))).toEqual([`${form.pageTitle} - ${serviceName} - GOV.UK`]);
  });

  it('server-renders one title starting "Error: " after a rejected submission', () => {
    expect(titlesIn(renderDocument(form, form.rejected))).toEqual([
      `Error: ${form.pageTitle} - ${serviceName} - GOV.UK`,
    ]);
  });

  it('server-renders a refusal that names no field in the summary, titled "Error: "', () => {
    const html = renderDocument(form, {
      ...(form.rejected as object),
      fieldErrors: {},
      formError: FORM_NOT_SAVED,
    });

    expect(titlesIn(html)).toEqual([`Error: ${form.pageTitle} - ${serviceName} - GOV.UK`]);
    expect(html).toMatch(/class="govuk-error-summary"/);
    expect(html).toContain(FORM_NOT_SAVED);
  });
});
