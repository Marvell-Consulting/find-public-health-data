import { fakeUsersForAudience } from '@fphd/auth';
import {
  IndicatorRoute,
  PublicHomePage,
  ReleasesPage,
  SignInPage,
  TopicRoute,
  TopicsRoute,
} from '@fphd/public-web-features';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
      dataUpdatedAt: '2026-04-20T16:25:18.000Z',
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
      areaTypes: [
        { name: 'England', areaCount: 1 },
        { name: 'Counties & UAs (from Apr 2023)', areaCount: 153 },
      ],
      topics: [{ slug: 'mortality-and-life-expectancy', title: 'Mortality and life expectancy' }],
    };
    const observations = [
      {
        fromDate: '2022-01-01',
        toDate: '2022-12-31',
        value: 342.2,
        lowerCi95: 340.1,
        upperCi95: 344.3,
        lowerCi998: null,
        upperCi998: null,
        count: 129000,
        denominator: null,
        dimensions: [{ type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 }],
      },
      {
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        value: 341.1,
        lowerCi95: 339.0,
        upperCi95: 343.2,
        lowerCi998: null,
        upperCi998: null,
        count: 130000,
        denominator: null,
        dimensions: [{ type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 }],
      },
      {
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        value: 420.5,
        lowerCi95: 417.2,
        upperCi95: 423.8,
        lowerCi998: null,
        upperCi998: null,
        count: 70000,
        denominator: null,
        dimensions: [
          { type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 },
          { type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 },
        ],
      },
    ];
    const areaData = [{ areaCode: 'E92000001', areaName: 'England', observations }];
    const areaGroups = [{ areaType: 'England', areas: [{ code: 'E92000001', name: 'England' }] }];
    const availableIndicators = [
      {
        id: 'a',
        fingertipsId: 108,
        name: 'Under 75 mortality rate from all causes',
        status: 'approved',
      },
    ];
    const selection = { areaType: 'England', areaCodes: [], fingertipsIds: [108] };
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'indicators/:fingertipsId',
            Component: IndicatorRoute,
            loader: () => ({
              selected: [{ detail: indicator, areaData }],
              areaGroups,
              availableIndicators,
              selection,
            }),
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators/108']} />);

    expect(
      await screen.findByRole('heading', { name: 'Under 75 mortality rate from all causes' }),
    ).toBeTruthy();

    // The summary table carries the source system's publication date and the collections
    // the indicator belongs to.
    expect(screen.getByText('20 April 2026')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Mortality and life expectancy' }).getAttribute('href'),
    ).toBe('/topics/mortality-and-life-expectancy');

    // The filter pane shows the selected indicator, its available area types, and a
    // checkbox per area of the selected type wired into the GET form.
    expect(screen.getByRole('heading', { name: 'Selected indicators' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Geography filters' })).toBeTruthy();
    // The name appears twice by design: as the page heading and in the sidebar's card.
    expect(screen.getAllByText('Under 75 mortality rate from all causes')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Remove Under 75 mortality rate from all causes filter' }),
    ).toBeTruthy();
    // Geographies are picked from the tree, not an area-type dropdown.
    expect(screen.getByRole('searchbox', { name: 'Add geographies' })).toBeTruthy();
    // The first area type opens by default, so its areas are selectable straight away.
    const areaCheckbox = screen
      .getAllByRole('checkbox', { name: /^England/ })
      .find((box) => box.getAttribute('name') === 'as');
    expect(areaCheckbox?.getAttribute('value')).toBe('E92000001');
    // Controls apply on change; the submit button exists only for the no-script path.

    // The prototype's tab set, with every panel a real anchor target.
    for (const name of ['Chart', 'Table', 'Inequalities', 'About this indicator']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
    // The chart placeholder is a labelled, keyboard-reachable region (ADR013).
    const region = screen.getByRole('region', { name: 'Indicator trends over time' });
    expect(region.getAttribute('tabindex')).toBe('0');

    // The trend table shows the least-disaggregated series in period order.
    expect(screen.getByRole('rowheader', { name: '2022' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '342.2' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '340.1 to 344.3' })).toBeTruthy();

    // The segmentation table breaks the latest period down by core segments.
    expect(screen.getByRole('rowheader', { name: '<75 yrs, Male' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '420.5' })).toBeTruthy();

    expect(
      screen.getByRole('heading', { name: 'Background information and indicator definitions' }),
    ).toBeTruthy();
    // Shown in the summary table and again under the definitions section, as the design does.
    expect(
      screen.getAllByText('Directly age-standardised mortality rate for all deaths.'),
    ).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Indicator rationale' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Office for National Statistics' }).getAttribute('href'),
    ).toBe('https://www.ons.gov.uk');
    // The indicator's own confidence level, in the metadata table rather than the
    // interval selector that offers the same wording.
    const confidenceRow = screen.getByText('Confidence level').closest('tr');
    expect(confidenceRow?.textContent).toContain('95%');
  });

  it('gathers ticked areas and applies them in one step', async () => {
    const loaderData = {
      selected: [],
      areaGroups: [
        {
          areaType: 'Statistical regions',
          areas: [
            { code: 'E12000001', name: 'North East' },
            { code: 'E12000002', name: 'North West' },
          ],
        },
      ],
      availableIndicators: [],
      selection: { areaType: 'England', areaCodes: [], fingertipsIds: [108] },
    };
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ path: 'indicators', Component: IndicatorRoute, loader: () => loaderData }],
      },
    ]);

    render(<Routes initialEntries={['/indicators?is=108']} />);

    // Nothing to apply until an area is ticked.
    expect(await screen.findByRole('searchbox', { name: 'Add geographies' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add selected geographies/ })).toBeNull();

    // The group is collapsed, so its checkbox is what selects everything beneath it.
    fireEvent.click(screen.getByRole('checkbox', { name: /^Statistical regions/ }));

    expect(
      await screen.findByRole('button', { name: 'Add selected geographies (2)' }),
    ).toBeTruthy();
  });

  it('compares selected areas row by row when more than one is selected', async () => {
    const observationFor = (value: number) => ({
      fromDate: '2023-01-01',
      toDate: '2023-12-31',
      value,
      lowerCi95: value - 2,
      upperCi95: value + 2,
      lowerCi998: null,
      upperCi998: null,
      count: 1000,
      denominator: null,
      dimensions: [{ type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 }],
    });
    const indicatorDetail = {
      fingertipsId: 108,
      name: 'Under 75 mortality rate from all causes',
      valueType: 'Directly standardised rate',
      unit: { name: 'per 100,000', label: 'per 100,000' },
      yearType: 'Calendar',
      frequency: 'Annual',
      polarity: 'RAG - Low is good',
      ciMethod: null,
      ciConfidenceLevel: null,
      comparatorMethod: null,
      dataUpdatedAt: null,
      definition: null,
      rationale: null,
      methodology: null,
      numeratorDefinition: null,
      denominatorDefinition: null,
      disclosureControl: null,
      caveats: null,
      notes: null,
      dataSource: null,
      numeratorSource: null,
      denominatorSource: null,
      areaTypes: [{ name: 'Regions (statistical)', areaCount: 9 }],
      topics: [],
    };
    const loaderData = {
      areaGroups: [
        {
          areaType: 'Regions (statistical)',
          areas: [
            { code: 'E12000001', name: 'North East' },
            { code: 'E12000002', name: 'North West' },
          ],
        },
      ],
      availableIndicators: [],
      selected: [
        {
          detail: indicatorDetail,
          areaData: [
            {
              areaCode: 'E12000001',
              areaName: 'North East',
              observations: [observationFor(410.3)],
            },
            {
              areaCode: 'E12000002',
              areaName: 'North West',
              observations: [observationFor(395.6)],
            },
          ],
        },
      ],
      selection: {
        areaType: 'Regions (statistical)',
        areaCodes: ['E12000001', 'E12000002'],
        fingertipsIds: [108],
      },
    };
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'indicators/:fingertipsId',
            Component: IndicatorRoute,
            loader: () => loaderData,
          },
        ],
      },
    ]);

    render(
      <Routes
        initialEntries={['/indicators/108?ats=Regions+(statistical)&as=E12000001&as=E12000002']}
      />,
    );

    // Both selected areas appear as removable chips in the geography card.
    expect(await screen.findByRole('heading', { name: 'Geography filters' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Remove North East filter' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Remove North West filter' })).toBeTruthy();

    // Both areas appear in the comparison, and their values with them.
    expect(screen.getAllByRole('rowheader', { name: 'North East' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('rowheader', { name: 'North West' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('cell', { name: '410.3' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('cell', { name: '395.6' }).length).toBeGreaterThan(0);
  });

  it('adds a comparison section only when more than one indicator is selected', async () => {
    const detailFor = (fingertipsId: number, name: string) => ({
      fingertipsId,
      name,
      valueType: 'Directly standardised rate',
      unit: { name: 'per 100,000', label: 'per 100,000' },
      yearType: 'Calendar',
      frequency: 'Annual',
      polarity: 'RAG - Low is good',
      ciMethod: null,
      ciConfidenceLevel: null,
      comparatorMethod: null,
      dataUpdatedAt: null,
      definition: null,
      rationale: null,
      methodology: null,
      numeratorDefinition: null,
      denominatorDefinition: null,
      disclosureControl: null,
      caveats: null,
      notes: null,
      dataSource: null,
      numeratorSource: null,
      denominatorSource: null,
      areaTypes: [{ name: 'England', areaCount: 1 }],
      topics: [],
    });
    const areaDataFor = (value: number) => [
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: [
          {
            fromDate: '2023-01-01',
            toDate: '2023-12-31',
            value,
            lowerCi95: null,
            upperCi95: null,
            lowerCi998: null,
            upperCi998: null,
            count: 500,
            denominator: null,
            dimensions: [],
          },
        ],
      },
    ];
    const routesFor = (loaderData: unknown) =>
      createRoutesStub([
        {
          path: '/',
          Component: PublicApp,
          loader: () => ({ signedIn: false }),
          children: [{ path: 'indicators', Component: IndicatorRoute, loader: () => loaderData }],
        },
      ]);

    const OneIndicator = routesFor({
      selected: [{ detail: detailFor(108, 'Mortality'), areaData: areaDataFor(341.1) }],
      areaGroups: [{ areaType: 'England', areas: [{ code: 'E92000001', name: 'England' }] }],
      availableIndicators: [],
      selection: { areaType: 'England', areaCodes: [], fingertipsIds: [108] },
    });
    render(<OneIndicator initialEntries={['/indicators?is=108']} />);

    expect(await screen.findByRole('heading', { name: 'Mortality' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Compare selected indicators' })).toBeNull();

    cleanup();

    const TwoIndicators = routesFor({
      selected: [
        { detail: detailFor(108, 'Mortality'), areaData: areaDataFor(341.1) },
        { detail: detailFor(90366, 'Life expectancy'), areaData: areaDataFor(80.1) },
      ],
      areaGroups: [{ areaType: 'England', areas: [{ code: 'E92000001', name: 'England' }] }],
      availableIndicators: [],
      selection: { areaType: 'England', areaCodes: [], fingertipsIds: [108, 90366] },
    });
    render(<TwoIndicators initialEntries={['/indicators?is=108&is=90366']} />);

    expect(
      await screen.findByRole('heading', { name: 'Compare selected indicators' }),
    ).toBeTruthy();
    // A block per indicator, plus a comparison row per indicator linking to its block.
    expect(screen.getByRole('heading', { name: 'Mortality' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Life expectancy' })).toBeTruthy();
    expect(screen.getByText('341.1 per 100,000')).toBeTruthy();
    expect(screen.getByText('80.1 per 100,000')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /^Remove .* filter$/ })).toHaveLength(2);
  });

  it('renders the empty state when nothing is selected', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'indicators',
            Component: IndicatorRoute,
            loader: () => ({
              selected: [],
              areaGroups: [],
              availableIndicators: [
                { id: 'a', fingertipsId: 108, name: 'Mortality', status: 'approved' },
              ],
              selection: { areaType: 'England', areaCodes: [], fingertipsIds: [] },
            }),
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators']} />);

    expect(await screen.findByText('None selected')).toBeTruthy();
    // Indicators are added through a type-ahead over the available list.
    expect(screen.getByRole('combobox', { name: 'Search for an indicator' })).toBeTruthy();
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
