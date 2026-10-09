// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  it('preserves and filters text entered before hydration through later renders', async () => {
    const page = (currentTopics = topics) => (
      <MemoryRouter>
        <TopicsPage topics={currentTopics} />
      </MemoryRouter>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(page());
    document.body.append(container);
    const input = container.querySelector('input');
    if (!input) throw new Error('Expected the server-rendered search input');
    input.value = 'quitting';
    const onRecoverableError = vi.fn();
    const root = await act(() => hydrateRoot(container, page(), { onRecoverableError }));
    try {
      await act(() => root.render(page([...topics])));
      expect(container.querySelector('input')).toBe(input);
      expect(input.value).toBe('quitting');
      expect(
        screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
      ).toEqual(['Smoking']);
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

  it.each(['', '  ', 'health'])(
    'shows an unavailable message for an empty dataset with query %s',
    (initialQuery) => {
      render(
        <MemoryRouter>
          <TopicsPage topics={[]} initialQuery={initialQuery} />
        </MemoryRouter>,
      );

      expect(screen.getByText('No topics are available.')).toBeTruthy();
      expect(screen.queryByText('No topics match your search.')).toBeNull();
    },
  );

  it('uses the same Unicode matching rule to filter and highlight topic content', () => {
    const { container } = render(
      <MemoryRouter>
        <TopicsPage
          topics={[
            { slug: 'istanbul', title: 'İstanbul', description: 'Town' },
            { slug: 'kelvin', title: 'K', description: 'Town' },
          ].map((topic) => ({
            ...topic,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          }))}
        />
      </MemoryRouter>,
    );
    const input = screen.getByRole('searchbox', { name: 'Search for topics' });
    fireEvent.change(input, { target: { value: 'i' } });
    expect(screen.queryByRole('link')).toBeNull();

    fireEvent.change(input, { target: { value: 'İ' } });
    expect(screen.getByRole('link', { name: 'İstanbul' })).toBeTruthy();
    expect(container.querySelector('mark')?.textContent).toBe('İ');

    fireEvent.change(input, { target: { value: 'k' } });
    expect(screen.getByRole('link', { name: 'K' })).toBeTruthy();
    expect(container.querySelector('mark')?.textContent).toBe('K');
  });

  it('hydrates the server-rendered no-script fallback without errors or replacing the input', async () => {
    const page = (
      <MemoryRouter>
        <TopicsPage topics={topics} />
      </MemoryRouter>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(page);
    document.body.append(container);
    const input = container.querySelector('input');
    const onRecoverableError = vi.fn();
    expect(container.querySelector('noscript')?.firstChild?.nodeType).toBe(Node.TEXT_NODE);

    const root = await act(() => hydrateRoot(container, page, { onRecoverableError }));
    try {
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector('input')).toBe(input);
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search for topics' }), {
        target: { value: 'quitting' },
      });
      expect(
        screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
      ).toEqual(['Smoking']);
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

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
