import { fakeUsersForAudience } from '@fphd/auth';
import {
  IndicatorRoute,
  PublicHomePage,
  SignInPage,
  TopicRoute,
  TopicsRoute,
} from '@fphd/public-web-features';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PublicApp, { ErrorBoundary } from './root';

afterEach(cleanup);

describe('public application routes', () => {
  it('renders the landing page introduction and shell navigation', async () => {
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
    expect(screen.getByRole('heading', { name: 'Public health data' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Using this service' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Find data' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Browse by topics' }).getAttribute('href')).toBe(
      '/topics',
    );
    expect(screen.getByRole('link', { name: 'Topics' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GOV.UK' })).toBeTruthy();
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
      { slug: 'topic-a', title: 'Topic A', description: 'All about topic A.' },
      { slug: 'topic-b', title: 'Topic B', description: 'All about topic B.' },
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

    expect(await screen.findByRole('heading', { name: 'Public health topics' })).toBeTruthy();

    const links = screen.getAllByRole('link', { name: /^Topic [AB]$/ });
    expect(links.map((link) => link.textContent)).toEqual(['Topic A', 'Topic B']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/topics/topic-a',
      '/topics/topic-b',
    ]);
    expect(screen.getByText('All about topic A.')).toBeTruthy();
    expect(screen.getByText('All about topic B.')).toBeTruthy();
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
      classifications: [
        { dimension: 'indicator_type', slug: 'indicator-type-outcome', name: 'Outcome' },
      ],
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
        notes: [],
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
        notes: [],
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
        notes: [],
        dimensions: [
          { type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 },
          { type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 },
        ],
      },
    ];
    const areaData = [{ areaCode: 'E92000001', areaName: 'England', observations }];
    const areaGroups = [
      { areaType: 'England', areas: [{ code: 'E92000001', name: 'England' }] },
      { areaType: 'UA unchanged', areas: [{ code: 'E06000052', name: 'Cornwall' }] },
    ];
    const selection = { areaType: 'England', areaCodes: [], areaLevels: [], fingertipsIds: [108] };
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
    // The name appears three times by design: the sidebar chip, the contents list and
    // the block's own heading.
    expect(screen.getAllByText('Under 75 mortality rate from all causes')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'Remove Under 75 mortality rate from all causes filter' }),
    ).toBeTruthy();
    // Geographies are picked from the tree, not an area-type dropdown.
    expect(screen.getByRole('searchbox', { name: 'Add geographies' })).toBeTruthy();
    // Raw Pholio area-type names are mapped to the prototype's display levels, and
    // England never appears in the tree — it is the default selected area.
    expect(screen.getByText('Local authorities')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /^England/ })).toBeNull();
    // Every level starts collapsed; expanding one reveals its areas.
    expect(screen.queryByRole('checkbox', { name: 'Cornwall' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Local authorities' }));
    const areaCheckbox = screen
      .getAllByRole('checkbox', { name: 'Cornwall' })
      .find((box) => box.getAttribute('name') === 'as');
    expect(areaCheckbox?.getAttribute('value')).toBe('E06000052');
    // Controls apply on change; the submit button exists only for the no-script path.

    // The prototype's tab set, with every panel a real anchor target.
    for (const name of ['Chart', 'Table', 'Inequalities', 'About this indicator']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
    // The chart placeholder is a labelled, keyboard-reachable region (ADR013).
    const region = screen.getByRole('region', { name: 'Indicator trends over time' });
    expect(region.getAttribute('tabindex')).toBe('0');

    // The trend table shows the least-disaggregated series in period order, laid out
    // the prototype's way: the area as a column group over count and calculated value.
    expect(screen.getByRole('rowheader', { name: '2022' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Count (Raw number)' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '342.2' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '129,000' })).toBeTruthy();

    // The About tab follows the prototype's section structure.
    for (const name of ['Overview', 'Data attributes', 'Calculation']) {
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    }
    // The definition lives in the summary table; the About tab opens with the rationale.
    expect(
      screen.getAllByText('Directly age-standardised mortality rate for all deaths.'),
    ).toHaveLength(1);
    expect(
      screen.getByText('Premature mortality is a key measure of population health.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Office for National Statistics' }).getAttribute('href'),
    ).toBe('https://www.ons.gov.uk');
    // The indicator's own confidence level, in the About summary list rather than the
    // interval selector that offers the same wording.
    const confidenceRow = screen.getByText('Confidence level').closest('div');
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
      selection: { areaType: 'England', areaCodes: [], areaLevels: [], fingertipsIds: [108] },
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

    // The button is always present so the form works without scripting; the count
    // appears once something is ticked.
    expect(await screen.findByRole('searchbox', { name: 'Add geographies' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add selected geographies' })).toBeTruthy();

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
      notes: [],
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
      classifications: [],
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
        areaLevels: [],
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

    // Both areas appear side by side as column groups, and their values with them.
    expect(screen.getAllByRole('columnheader', { name: 'North East' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'North West' }).length).toBeGreaterThan(0);
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
      classifications: [],
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
            notes: [],
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
      selection: { areaType: 'England', areaCodes: [], areaLevels: [], fingertipsIds: [108] },
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
      selection: {
        areaType: 'England',
        areaCodes: [],
        areaLevels: [],
        fingertipsIds: [108, 90366],
      },
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
              selection: { areaType: 'England', areaCodes: [], areaLevels: [], fingertipsIds: [] },
            }),
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators']} />);

    expect(await screen.findByText('None selected')).toBeTruthy();
    // The main pane shows the prototype's inset-text empty state.
    expect(screen.getByText('No indicators selected')).toBeTruthy();
    // The search input arrives server-rendered and is replaced asynchronously by the
    // accessible-autocomplete combobox, so the role must be awaited.
    expect(await screen.findByRole('combobox', { name: 'Search for an indicator' })).toBeTruthy();
  });

  it('suggests server matches as you type and adds the picked indicator in two steps', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ indicators: [{ fingertipsId: 108, name: 'Mortality' }] }), {
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const loaderUrls: string[] = [];
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [
          {
            path: 'indicators',
            Component: IndicatorRoute,
            loader: ({ request }: { request: Request }) => {
              loaderUrls.push(request.url);
              return {
                selected: [],
                areaGroups: [],
                selection: {
                  areaType: 'England',
                  areaCodes: [],
                  areaLevels: [],
                  fingertipsIds: [],
                },
              };
            },
          },
        ],
      },
    ]);

    try {
      render(<Routes initialEntries={['/indicators']} />);

      const combobox = await screen.findByRole('combobox', { name: 'Search for an indicator' });
      // Picking a suggestion only readies it; the Add indicator button commits it.
      expect(screen.queryByRole('button', { name: 'Add indicator' })).toBeNull();
      fireEvent.input(combobox, { target: { value: 'mort' } });

      // The debounce holds the request for 300ms; the suggestion appearing proves the
      // server round-trip and the escape-safe template.
      const option = await screen.findByRole('option', { name: 'Mortality' }, { timeout: 3000 });
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('/indicators/search?q=mort', expect.anything());

      fireEvent.click(option);
      const addButton = await screen.findByRole('button', { name: 'Add indicator' });
      fireEvent.click(addButton);
      // Committing navigates: the loader re-runs with the picked indicator selected.
      await waitFor(() => {
        expect(loaderUrls.some((url) => url.includes('is=108'))).toBe(true);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers only the period shapes the picked areas publish', async () => {
    const observation = (fromDate: string, toDate: string, value: number) => ({
      fromDate,
      toDate,
      value,
      lowerCi95: null,
      upperCi95: null,
      lowerCi998: null,
      upperCi998: null,
      count: null,
      denominator: null,
      notes: [],
      dimensions: [{ type: 'Age', value: 'All ages', dimensionClass: 'core', sortOrder: 1 }],
    });
    const detail = {
      fingertipsId: 93995,
      name: 'Mortality rate for deaths involving diabetes, all ages',
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
      areaTypes: [{ name: 'UA unchanged', areaCount: 125 }],
      topics: [],
      classifications: [],
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
            loader: () => ({
              areaGroups: [
                { areaType: 'UA unchanged', areas: [{ code: 'E06000052', name: 'Cornwall' }] },
              ],
              selected: [
                {
                  detail,
                  areaData: [
                    {
                      areaCode: 'E06000052',
                      areaName: 'Cornwall',
                      // Rolling-only: no single-year series exists for the picked area.
                      observations: [observation('2021-01-01', '2023-12-31', 10.2)],
                    },
                    {
                      areaCode: 'E92000001',
                      areaName: 'England',
                      // England publishes both shapes, but must not put a period
                      // choice on a page whose picked area cannot honour it.
                      observations: [
                        observation('2021-01-01', '2023-12-31', 11.4),
                        observation('2023-01-01', '2023-12-31', 11.9),
                      ],
                    },
                  ],
                },
              ],
              selection: {
                areaType: 'England',
                areaCodes: ['E06000052'],
                areaLevels: [],
                fingertipsIds: [93995],
              },
            }),
          },
        ],
      },
    ]);

    // A stale pt param in the URL must fall back to All, not blank the table.
    render(<Routes initialEntries={['/indicators/93995?as=E06000052&pt-93995=1-year']} />);

    expect(
      await screen.findByRole('heading', {
        name: 'Mortality rate for deaths involving diabetes, all ages',
      }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Select time period type')).toBeNull();
    expect(screen.getByRole('rowheader', { name: '2021 to 2023' })).toBeTruthy();
  });

  it('offers a benchmark beside each picked area with an optional comparison range', async () => {
    const observationFor = (value: number) => ({
      fromDate: '2023-01-01',
      toDate: '2023-12-31',
      value,
      lowerCi95: null,
      upperCi95: null,
      lowerCi998: null,
      upperCi998: null,
      count: null,
      denominator: null,
      notes: [],
      dimensions: [{ type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 }],
    });
    const detail = {
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
      areaTypes: [{ name: 'UA unchanged', areaCount: 125 }],
      topics: [],
      classifications: [],
    };
    // The segment matches the fixture observations' dimension values, as the table only
    // brackets a row with a range describing the same population.
    const rangePeriod = {
      fromDate: '2023-01-01',
      toDate: '2023-12-31',
      segment: '<75 yrs',
      min: 300.1,
      max: 500.9,
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
            loader: () => ({
              areaGroups: [
                { areaType: 'UA unchanged', areas: [{ code: 'E06000052', name: 'Cornwall' }] },
              ],
              benchmarkGeography: {
                regionByCode: { E06000052: { code: 'E12000009', name: 'South West' } },
                levelByCode: { E06000052: 'Local authorities' },
              },
              selected: [
                {
                  detail,
                  areaData: [
                    {
                      areaCode: 'E06000052',
                      areaName: 'Cornwall',
                      observations: [observationFor(395.6)],
                    },
                    {
                      areaCode: 'E92000001',
                      areaName: 'England',
                      observations: [observationFor(410.3)],
                    },
                  ],
                  regionData: [
                    {
                      areaCode: 'E12000009',
                      areaName: 'South West',
                      observations: [observationFor(400.2)],
                    },
                  ],
                  ranges: {
                    'Local authorities': [rangePeriod],
                    'Statistical regions': [rangePeriod],
                  },
                },
              ],
              selection: {
                areaType: 'England',
                areaCodes: ['E06000052'],
                areaLevels: [],
                fingertipsIds: [108],
              },
            }),
          },
        ],
      },
    ]);

    render(<Routes initialEntries={['/indicators/108?as=E06000052']} />);

    // England is not a column of its own while a real area is picked and no benchmark
    // is chosen.
    const select = await screen.findByLabelText('Select a geography or goal to compare with');
    expect(screen.queryByRole('columnheader', { name: 'England' })).toBeNull();

    fireEvent.change(select, { target: { value: 'england' } });
    expect(screen.getByRole('columnheader', { name: 'England' })).toBeTruthy();

    // Turning the range on adds the spread and the dot-and-whisker comparison.
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByRole('columnheader', { name: 'Minimum' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Maximum' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '300.1' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '500.9' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Cornwall 395.6 against England 410.3/ })).toBeTruthy();

    // The statistical-region benchmark takes the parent region's name and values.
    fireEvent.change(select, { target: { value: 'region' } });
    expect(
      screen.getByRole('columnheader', { name: 'South West (Statistical region)' }),
    ).toBeTruthy();
    expect(screen.getByRole('cell', { name: '400.2' })).toBeTruthy();
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
