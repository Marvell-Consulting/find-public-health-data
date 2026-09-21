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

    const polarity = group('Data').getByText('Polarity');

    expect(screen.queryByRole('link', { name: 'Polarity' })).toBeNull();
    expect(polarity.closest('li')?.textContent).toContain('Not started');
  });

  it('links only the tasks that can be worked on today', () => {
    renderPage();

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Back to indicator',
      'Name',
    ]);
  });

  it('tags a task that is not started and leaves a completed one as text', () => {
    renderPage();

    expect(screen.getAllByText('Not started')[0]?.className).toContain('govuk-tag--grey');
    expect(screen.getByText('Completed').className).not.toContain('govuk-tag');
  });

  it('links back to the indicator overview', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to indicator' }).getAttribute('href')).toBe(
      `/dashboard/indicators/${taskList.indicator.id}`,
    );
  });
});
