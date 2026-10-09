// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { TopicsPage } from './pages.tsx';

afterEach(cleanup);

const topics = [
  { slug: 'smoking', title: 'Smoking', description: 'Smoking prevalence and quitting.' },
  { slug: 'alcohol', title: 'Alcohol', description: 'Drinking and related harms.' },
  { slug: 'hidden-quitting', title: 'Cancer', description: 'Screening and diagnosis.' },
].map((topic) => ({
  ...topic,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}));

describe('TopicsPage', () => {
  it('filters by title and description as the user types, ignoring case and surrounding spaces', () => {
    render(
      <MemoryRouter>
        <TopicsPage topics={topics} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('searchbox', { name: 'Search for topics' });

    fireEvent.change(input, { target: { value: ' ALCO ' } });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Alcohol']);

    fireEvent.change(input, { target: { value: 'quitting' } });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Smoking']);
    expect(screen.getByRole('status').textContent).toBe('1 topic found.');
  });

  it('shows an empty result message and restores the original list when the search is cleared', () => {
    const { container } = render(
      <MemoryRouter>
        <TopicsPage topics={topics} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('searchbox', { name: 'Search for topics' });

    fireEvent.change(input, { target: { value: '[nothing]' } });
    expect(screen.getByText('No topics match your search.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('0 topics found.');

    fireEvent.change(input, { target: { value: ' ' } });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(topics.map((topic) => topic.title));
    expect(screen.queryByText('No topics match your search.')).toBeNull();
    expect(container.querySelector('mark')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('3 topics found.');
  });
});
