import { createDocumentMeta, serviceName } from '@fphd/ui';
import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoutesStub, Meta, type MetaFunction, Outlet } from 'react-router';
import { describe, expect, it } from 'vitest';

import * as calculation from './indicator-calculation/route.tsx';
import * as definitionAndRationale from './indicator-definition-and-rationale/route.tsx';
import * as editIndicatorName from './indicator-name/edit-route.tsx';
import * as newIndicator from './indicator-name/new-route.tsx';
import * as polarity from './indicator-polarity/route.tsx';
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
});
