// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorAdminDetail } from './loader';
import { IndicatorOverviewPage } from './page';

afterEach(cleanup);

const indicator: IndicatorAdminDetail = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  shortId: 90366,
  name: 'Life expectancy at birth',
  status: 'approved',
  updatedAt: '2026-08-04T23:30:00.000Z',
};

// The links and tabs read router state, so the page renders inside a router at its own address.
function renderPage(overrides: Partial<IndicatorAdminDetail> = {}) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/indicators/${indicator.id}`]}>
      <IndicatorOverviewPage indicator={{ ...indicator, ...overrides }} />
    </MemoryRouter>,
  );
}

describe('IndicatorOverviewPage', () => {
  it('names the indicator and shows its public number', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Life expectancy at birth' }),
    ).toBeTruthy();
    expect(screen.getByText('Indicator ID')).toBeTruthy();
    expect(screen.getByText('90366')).toBeTruthy();
  });

  it.each([
    ['draft', 'Draft', 'grey'],
    ['in_review', 'In review', 'yellow'],
    ['approved', 'Approved', 'green'],
    ['archived', 'Archived', 'grey'],
  ] as const)('labels a status of %s as a %s tag', (status, label, colour) => {
    renderPage({ status });

    const tag = screen.getByText(label);

    expect(tag.className).toContain('govuk-tag');
    expect(tag.className).toContain(`govuk-tag--${colour}`);
  });

  it('offers the published page as an action for an approved indicator', () => {
    renderPage();

    expect(screen.getByRole('tab', { name: 'Actions' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View published indicator' }).getAttribute('href'),
    ).toBe('/indicators/90366');
  });

  it.each(['draft', 'in_review', 'archived'] as const)(
    'offers no action for a %s indicator, which has no published page',
    (status) => {
      renderPage({ status });

      expect(screen.queryByRole('link', { name: 'View published indicator' })).toBeNull();
      expect(
        screen.getByText('There are no actions available for this indicator yet.'),
      ).toBeTruthy();
    },
  );

  it('links back to the dashboard', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to indicators' }).getAttribute('href')).toBe(
      '/dashboard',
    );
  });
});
