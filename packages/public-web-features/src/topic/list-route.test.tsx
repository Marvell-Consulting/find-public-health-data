// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { TopicsRoute } from './list-route.tsx';

afterEach(cleanup);

describe('TopicsRoute', () => {
  it('renders a submitted search from the URL with matching content highlighted', async () => {
    const Routes = createRoutesStub([
      {
        path: '/topics',
        Component: TopicsRoute,
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
