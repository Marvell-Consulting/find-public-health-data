// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { TaskList } from './task-list.tsx';

afterEach(cleanup);

const items = [
  { id: 'name', title: 'Name', href: '/publish/name', status: 'Completed' },
  { id: 'polarity', title: 'Polarity', status: 'Not started' },
];

function renderTasks(idPrefix?: string) {
  return render(
    <MemoryRouter>
      <TaskList idPrefix={idPrefix} items={items} />
    </MemoryRouter>,
  );
}

describe('TaskList', () => {
  it('links a task that can be worked on and leaves the rest as text', () => {
    renderTasks();

    expect(screen.getByRole('link', { name: 'Name' }).getAttribute('href')).toBe('/publish/name');
    expect(screen.queryByRole('link', { name: 'Polarity' })).toBeNull();
    expect(screen.getByText('Polarity')).toBeTruthy();
  });

  it('describes a task link by its own status', () => {
    renderTasks();

    const describedBy = screen.getByRole('link', { name: 'Name' }).getAttribute('aria-describedby');

    expect(describedBy).toBe('task-list-name-status');
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe('Completed');
  });

  it('prefixes status ids so two lists on a page do not collide', () => {
    renderTasks('data');

    expect(screen.getByRole('link', { name: 'Name' }).getAttribute('aria-describedby')).toBe(
      'data-name-status',
    );
  });

  it('marks only the rows with a link as such, as the styling depends on it', () => {
    renderTasks();

    const [named, polarity] = screen.getAllByRole('listitem');

    expect(named?.className).toContain('govuk-task-list__item--with-link');
    expect(polarity?.className).not.toContain('govuk-task-list__item--with-link');
  });
});
