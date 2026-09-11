// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DashboardPage } from './page';

afterEach(cleanup);

const indicator = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  name: 'Life expectancy at birth',
  updatedAt: '2026-08-04T23:30:00.000Z',
};

// The pagination links read router state, so the page renders inside a router at its own address.
function renderPage(props: Partial<Parameters<typeof DashboardPage>[0]> = {}, url = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <DashboardPage indicators={[indicator]} page={1} totalPages={1} {...props} />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('names the columns of the prototype that have data behind them', () => {
    renderPage();

    for (const heading of [
      'Indicator name',
      'Last edited',
      'Indicator status',
      'Publishing status',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    }
  });

  it('shows when each indicator was last edited, in the display time zone', () => {
    renderPage();

    expect(screen.getByRole('rowheader', { name: 'Life expectancy at birth' })).toBeTruthy();
    // 23:30 UTC on the 4th is 00:30 on the 5th in London.
    expect(screen.getByText('5 Aug 2026').getAttribute('datetime')).toBe(indicator.updatedAt);
  });

  it('says so when there are no indicators', () => {
    renderPage({ indicators: [] });

    expect(screen.getByText('There are no indicators yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('paginates only when there is more than one page', () => {
    renderPage();

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('links to every page, marking the current one', () => {
    renderPage({ page: 2, totalPages: 3 }, '/dashboard?page=2');

    const navigation = screen.getByRole('navigation', { name: 'Pagination' });

    expect(navigation).toBeTruthy();
    expect(screen.getByRole('link', { name: '1' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.getByRole('link', { name: '3' }).getAttribute('href')).toBe('/dashboard?page=3');
    expect(screen.getByRole('link', { name: '2' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '1' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: /Previous/ }).getAttribute('href')).toBe('/dashboard');
    expect(screen.getByRole('link', { name: /Next/ }).getAttribute('href')).toBe(
      '/dashboard?page=3',
    );
  });
});
