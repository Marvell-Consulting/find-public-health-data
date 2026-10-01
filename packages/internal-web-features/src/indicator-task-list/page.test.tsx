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

    const dataTable = group('Data').getByText('Data table');

    expect(screen.queryByRole('link', { name: 'Data table' })).toBeNull();
    expect(dataTable.closest('li')?.textContent).toContain('Not started');
  });

  it('links only the tasks that can be worked on today', () => {
    renderPage();

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Value type and units',
      'Sex and ages',
      'Period type',
      'Polarity',
      'Data quality',
      'Name',
      'Definition and rationale',
      'Numerator',
      'Denominator',
      'How the indicator was calculated',
      'Confidence intervals',
      'Benchmarking',
      'Other notes and caveats',
      'Links',
      'Tagging',
      'Copyright and data re-use',
      'Update frequency',
      'Publishing date',
      'Variance and quality',
      'Justifications',
      'Other comments',
    ]);
  });

  const NOTES = 'Notes for reviewers (for internal use only)';

  it.each([
    ['Data', 'Value type and units', 'value-type-and-units'],
    ['Data', 'Sex and ages', 'sex-and-ages'],
    ['Data', 'Period type', 'period-type'],
    ['Data', 'Polarity', 'polarity'],
    ['Data', 'Data quality', 'data-quality'],
    ['Metadata', 'Definition and rationale', 'definition-and-rationale'],
    ['Metadata', 'Numerator', 'numerator'],
    ['Metadata', 'Denominator', 'denominator'],
    ['Metadata', 'How the indicator was calculated', 'calculation'],
    ['Metadata', 'Confidence intervals', 'confidence-intervals'],
    ['Metadata', 'Benchmarking', 'benchmarking'],
    ['Metadata', 'Other notes and caveats', 'other-notes-and-caveats'],
    ['Metadata', 'Links', 'links'],
    ['Metadata', 'Tagging', 'tagging'],
    ['Metadata', 'Copyright and data re-use', 'copyright-and-data-reuse'],
    ['Publishing', 'Update frequency', 'update-frequency'],
    ['Publishing', 'Publishing date', 'publishing-date'],
    [NOTES, 'Variance and quality', 'variance-and-quality'],
    [NOTES, 'Justifications', 'justifications'],
    [NOTES, 'Other comments', 'other-comments'],
  ] as const)('links %s: %s to its page, with the status the API reports', (title, name, key) => {
    renderPage({ tasks: { name: 'completed', [key]: 'completed' } });

    const row = group(title).getByRole('link', { name });

    expect(row.getAttribute('href')).toBe(`/publish/indicators/${taskList.indicator.id}/${key}`);
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
