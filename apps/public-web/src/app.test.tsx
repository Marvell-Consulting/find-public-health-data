import { fakeUsersForAudience } from '@fphd/auth';
import {
  IndicatorRoute,
  PublicHomePage,
  ReleasesPage,
  SignInPage,
  TopicRoute,
  TopicsRoute,
} from '@fphd/public-web-features';
import { cleanup, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import PublicApp, { ErrorBoundary } from './root';

afterEach(cleanup);

describe('public application routes', () => {
  it('renders the prototype-aligned search landing page', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ index: true, Component: PublicHomePage }],
      },
    ]);

    render(<Routes initialEntries={['/']} />);

    expect(await screen.findByRole('heading', { name: 'Find public health data' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search for indicators' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Topic summaries for England' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Latest release' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Releases' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });

  it('renders the prototype release route and shared shell', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GOV.UK' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Releases' })).toBeTruthy();
  });

  it('offers all fake users on the public sign-in page', () => {
    render(<SignInPage audience="public" returnTo="/" users={fakeUsersForAudience('public')} />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('links to the account when a user is signed in', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: true }),
        children: [{ index: true, Component: PublicHomePage }],
      },
    ]);

    render(<Routes initialEntries={['/']} />);

    expect((await screen.findByRole('link', { name: 'Account' })).getAttribute('href')).toBe(
      '/sign-in',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('renders the topics page as an alphabetical list of links from loader data', async () => {
    // Ordering is the repository/API's responsibility (asserted elsewhere); this fixture is
    // already alphabetical, and the page must render it in that order without reshuffling.
    const topics = [
      { slug: 'topic-a', title: 'Topic A' },
      { slug: 'topic-b', title: 'Topic B' },
    ];
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ path: 'topics', Component: TopicsRoute, loader: () => topics }],
      },
    ]);

    render(<Routes initialEntries={['/topics']} />);

    expect(await screen.findByRole('heading', { name: 'Topics' })).toBeTruthy();

    const links = screen.getAllByRole('link', { name: /^Topic [AB]$/ });
    expect(links.map((link) => link.textContent)).toEqual(['Topic A', 'Topic B']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/topics/topic-a',
      '/topics/topic-b',
    ]);
  });

  it('renders the topic page title and description from loader data', async () => {
    const topic = {
      slug: 'topic-a',
      title: 'Topic A',
      description: 'All about topic A.',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ path: 'topics/:slug', Component: TopicRoute, loader: () => topic }],
      },
    ]);

    render(<Routes initialEntries={['/topics/topic-a']} />);

    expect(await screen.findByRole('heading', { name: 'Topic A' })).toBeTruthy();
    expect(screen.getByText('All about topic A.')).toBeTruthy();
  });

  it('renders the indicator page skeleton from loader data', async () => {
    const indicator = {
      fingertipsId: 108,
      name: 'Under 75 mortality rate from all causes',
      valueType: 'Directly standardised rate',
      unit: { name: 'per 100,000', label: 'per 100,000' },
      yearType: 'Calendar',
      frequency: 'Annual',
      polarity: 'RAG - Low is good',
      ciMethod: "Dobson & Byar's methods",
      ciConfidenceLevel: '95',
      comparatorMethod: null,
      definition: 'Directly age-standardised mortality rate for all deaths.',
      rationale: 'Premature mortality is a key measure of population health.',
      methodology: null,
      numeratorDefinition: null,
      denominatorDefinition: null,
      disclosureControl: null,
      caveats: null,
      notes: null,
      dataSource: { name: 'Office for National Statistics', url: 'https://www.ons.gov.uk' },
      numeratorSource: null,
      denominatorSource: null,
      areaTypes: [{ name: 'Counties & UAs (from Apr 2023)', areaCount: 153 }],
    };
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [
          { path: 'indicators/:fingertipsId', Component: IndicatorRoute, loader: () => indicator },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators/108']} />);

    expect(
      await screen.findByRole('heading', { name: 'View data for selected indicators and areas' }),
    ).toBeTruthy();

    // The filter pane shows the selected indicator and its available area types.
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeTruthy();
    expect(screen.getByText('Under 75 mortality rate from all causes')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View background information' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Counties & UAs (from Apr 2023)' })).toBeTruthy();

    // The chart placeholders are labelled, keyboard-reachable regions (ADR013), one per
    // chart in the initial scope.
    for (const name of [
      'Indicator segmentations overview',
      'Indicator trends over time',
      'Compare areas for one time period',
    ]) {
      const region = screen.getByRole('region', { name });
      expect(region.getAttribute('tabindex')).toBe('0');
    }

    expect(
      screen.getByRole('heading', { name: 'Background information and indicator definitions' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Directly age-standardised mortality rate for all deaths.'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Indicator rationale' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Office for National Statistics' }).getAttribute('href'),
    ).toBe('https://www.ons.gov.uk');
    expect(screen.getByText('Confidence level')).toBeTruthy();
    expect(screen.getByText('95%')).toBeTruthy();
  });

  it('renders the not-found page when the indicator loader throws a 404 response', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        ErrorBoundary,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'indicators/:fingertipsId',
            Component: IndicatorRoute,
            loader: () => {
              throw new Response('Not Found', { status: 404 });
            },
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators/424242']} />);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('renders the not-found page when the topic loader throws a 404 response', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        ErrorBoundary,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'topics/:slug',
            Component: TopicRoute,
            loader: () => {
              throw new Response('Not Found', { status: 404 });
            },
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/topics/no-such-topic']} />);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
