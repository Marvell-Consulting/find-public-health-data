// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorAdminDetail } from './loader.ts';
import { IndicatorOverviewPage } from './page.tsx';

afterEach(cleanup);

const indicator: IndicatorAdminDetail = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  shortId: 90366,
  name: 'Life expectancy at birth',
  publishedSlug: 'life-expectancy-at-birth',
  updatedAt: '2026-08-04T23:30:00.000Z',
  indicatorStatus: 'live',
  draftStatus: null,
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
    expect(screen.getByText('Indicator number')).toBeTruthy();
    expect(screen.getByText('90366')).toBeTruthy();
  });

  it('shows the indicator status and the publishing status as tags', () => {
    renderPage({ draftStatus: 'draft' });

    expect(screen.getByText('Indicator status')).toBeTruthy();
    expect(screen.getByText('Live').className).toContain('govuk-tag');
    expect(screen.getByText('Publishing status')).toBeTruthy();
    expect(screen.getByText('Update incomplete').className).toContain('govuk-tag');
  });

  it('offers the published page as an action for a published indicator', () => {
    renderPage();

    expect(screen.getByRole('tab', { name: 'Actions' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View published indicator' }).getAttribute('href'),
    ).toBe('/indicators/life-expectancy-at-birth');
  });

  it('offers the task list as an action for a draft, which has no public page', () => {
    renderPage({ publishedSlug: null, indicatorStatus: 'new', draftStatus: 'draft' });

    expect(screen.queryByRole('link', { name: 'View published indicator' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Continue creating indicator' }).getAttribute('href'),
    ).toBe(`/publish/indicators/${indicator.id}/task-list`);
  });

  it('offers both actions for a draft that revises a published indicator', () => {
    renderPage({ draftStatus: 'draft' });

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Continue creating indicator',
      'View published indicator',
    ]);
  });

  it('offers no editing action for a published indicator, which has no draft', () => {
    renderPage();

    expect(screen.queryByRole('link', { name: 'Continue creating indicator' })).toBeNull();
  });
});
