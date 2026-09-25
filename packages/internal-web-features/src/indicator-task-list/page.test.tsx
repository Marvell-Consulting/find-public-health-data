// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorTaskList } from './loader.ts';
import { IndicatorTaskListPage } from './page.tsx';

afterEach(cleanup);

const taskList: IndicatorTaskList = {
  indicator: {
    id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
    shortId: 90366,
    name: 'Life expectancy at birth',
    indicatorStatus: 'new',
    draftStatus: 'draft',
  },
  isUpdate: false,
  canSubmit: true,
  tasks: { name: 'completed' },
};

function renderPage(overrides: Partial<IndicatorTaskList> = {}) {
  return render(
    <MemoryRouter initialEntries={[`/publish/indicators/${taskList.indicator.id}/task-list`]}>
      <IndicatorTaskListPage taskList={{ ...taskList, ...overrides }} />
    </MemoryRouter>,
  );
}

/** The rows of one group, which is the list following its heading. */
function group(title: string) {
  const heading = screen.getByRole('heading', { level: 2, name: title });
  const list = heading.nextElementSibling;

  if (!(list instanceof HTMLElement)) throw new Error(`no task list under ${title}`);

  return within(list);
}

describe('IndicatorTaskListPage', () => {
  it('names the indicator and captions it with its public number', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Life expectancy at birth' }),
    ).toBeTruthy();
    expect(screen.getByText('ID: 90366')).toBeTruthy();
  });

  it('tags the indicator with its two statuses under the heading', () => {
    renderPage({ isUpdate: true, indicator: { ...taskList.indicator, indicatorStatus: 'live' } });

    // The tags follow the public number, under the heading.
    const tags = [...document.querySelectorAll('h1 ~ p .govuk-tag')];

    expect(tags.map((tag) => tag.textContent)).toEqual([
      'Indicator status: Live indicator',
      'Publishing status: Update incomplete',
    ]);
  });

  it('groups the fields a publisher completes', () => {
    renderPage();

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Data', 'Metadata', 'Publishing', 'Notes for reviewers (for internal use only)']);
    expect(group('Data').getAllByRole('listitem')).toHaveLength(6);
    expect(group('Metadata').getAllByRole('listitem')).toHaveLength(11);
    expect(group('Publishing').getAllByRole('listitem')).toHaveLength(2);
    expect(
      group('Notes for reviewers (for internal use only)').getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('shows the status the API reports for a task it judges', () => {
    renderPage();

    const name = group('Metadata').getByRole('link', { name: 'Name' });

    expect(name.getAttribute('href')).toBe(`/publish/indicators/${taskList.indicator.id}/name`);
    expect(document.getElementById(name.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('follows the API when it reports a task as not started', () => {
    renderPage({ tasks: { name: 'not_started' } });

    const name = group('Metadata').getByRole('link', { name: 'Name' });
    const status = document.getElementById(name.getAttribute('aria-describedby') ?? '');

    expect(status?.textContent).toBe('Not started');
  });

  it('shows a task with no form yet as not started, without a link', () => {
    renderPage();

    const dataQuality = group('Data').getByText('Data quality');

    expect(screen.queryByRole('link', { name: 'Data quality' })).toBeNull();
    expect(dataQuality.closest('li')?.textContent).toContain('Not started');
  });

  it('links only the tasks that can be worked on today', () => {
    renderPage();

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Polarity',
      'Name',
      'Definition and rationale',
      'How the indicator was calculated',
      'Confidence intervals',
      'Other notes and caveats',
      'Links',
      'Update frequency',
      'Publishing date',
      'Variance and quality',
    ]);
  });

  it('links the update frequency to its page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'update-frequency': 'completed' } });

    const row = group('Publishing').getByRole('link', { name: 'Update frequency' });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/update-frequency`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the confidence intervals to their page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'confidence-intervals': 'completed' } });

    const row = group('Metadata').getByRole('link', { name: 'Confidence intervals' });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/confidence-intervals`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the other notes and caveats to their page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'other-notes-and-caveats': 'completed' } });

    const row = group('Metadata').getByRole('link', { name: 'Other notes and caveats' });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/other-notes-and-caveats`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the publishing date to its page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'publishing-date': 'completed' } });

    const row = group('Publishing').getByRole('link', { name: 'Publishing date' });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/publishing-date`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the polarity to its page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', polarity: 'completed' } });

    const row = group('Data').getByRole('link', { name: 'Polarity' });

    expect(row.getAttribute('href')).toBe(`/publish/indicators/${taskList.indicator.id}/polarity`);
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the definition and rationale to its page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'definition-and-rationale': 'not_started' } });

    const row = group('Metadata').getByRole('link', { name: 'Definition and rationale' });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/definition-and-rationale`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Not started',
    );
  });

  it('links the links to their page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', links: 'completed' } });

    const row = group('Metadata').getByRole('link', { name: 'Links' });

    expect(row.getAttribute('href')).toBe(`/publish/indicators/${taskList.indicator.id}/links`);
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('links the variance and quality to its page, with the status the API reports', () => {
    renderPage({ tasks: { name: 'completed', 'variance-and-quality': 'completed' } });

    const row = group('Notes for reviewers (for internal use only)').getByRole('link', {
      name: 'Variance and quality',
    });

    expect(row.getAttribute('href')).toBe(
      `/publish/indicators/${taskList.indicator.id}/variance-and-quality`,
    );
    expect(document.getElementById(row.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Completed',
    );
  });

  it('tells the publisher the sections can be completed in any order', () => {
    renderPage();

    expect(screen.getByText(/You can complete these sections in any order/).className).toContain(
      'govuk-inset-text',
    );
  });

  it('tags a task that is not started and leaves a completed one as text', () => {
    renderPage();

    expect(screen.getAllByText('Not started')[0]?.className).toContain('govuk-tag--blue');
    expect(screen.getByText('Completed').className).not.toContain('govuk-tag');
  });
});
