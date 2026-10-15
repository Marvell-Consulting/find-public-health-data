// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { shouldRevalidate, TopicsRoute } from './list-route.tsx';

afterEach(cleanup);

describe('TopicsRoute', () => {
  it('updates the URL without replacing the input or fetching topics again', async () => {
    const loader = vi.fn(() => [
      { slug: 'alcohol', title: 'Alcohol', description: 'Drinking and related harms.' },
      { slug: 'smoking', title: 'Smoking', description: 'Prevalence and quitting.' },
    ]);
    const Routes = createRoutesStub([
      {
        path: '/topics',
        loader,
        shouldRevalidate,
        Component: () => {
          const location = useLocation();
          return (
            <>
              <TopicsRoute />
              <output data-testid="url">{location.search}</output>
            </>
          );
        },
      },
    ]);
    render(<Routes initialEntries={['/topics?other=kept&q=old']} />);
    const input = await screen.findByRole('searchbox', { name: 'Search for topics' });
    input.focus();
    fireEvent.change(input, { target: { value: 'smok' } });
    expect(await screen.findByRole('link', { name: 'Smoking' })).toBeTruthy();
    expect(screen.getByTestId('url').textContent).toBe('?other=kept&q=smok');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(await screen.findByRole('link', { name: 'Alcohol' })).toBeTruthy();
    expect(screen.getByTestId('url').textContent).toBe('?other=kept');
    expect(screen.getByRole('searchbox', { name: 'Search for topics' })).toBe(input);
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('renders a submitted search from the URL with matching content highlighted', async () => {
    const Routes = createRoutesStub([
      {
        path: '/topics',
        Component: TopicsRoute,
        shouldRevalidate,
        loader: () => [
          { slug: 'alcohol', title: 'Alcohol', description: 'Drinking and related harms.' },
          { slug: 'smoking', title: 'Smoking', description: 'Prevalence and quitting.' },
        ],
      },
    ]);
    const { container } = render(<Routes initialEntries={['/topics?q=%20QUITTING%20']} />);

    expect(await screen.findByRole('link', { name: 'Smoking' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Alcohol' })).toBeNull();
    expect(
      (screen.getByRole('searchbox', { name: 'Search for topics' }) as HTMLInputElement).value,
    ).toBe(' QUITTING ');
    expect(container.querySelector('mark')?.textContent).toBe('quitting');
  });
});
