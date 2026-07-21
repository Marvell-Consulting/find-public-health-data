import { PublicHomePage, ReleasesPage } from '@fphd/public-web-features';
import { cleanup, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import PublicApp from './root';

afterEach(cleanup);

describe('public application routes', () => {
  it('renders the prototype-aligned search landing page', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        children: [{ index: true, Component: PublicHomePage }],
      },
    ]);

    render(<Routes initialEntries={['/']} />);

    expect(await screen.findByRole('heading', { name: 'Find public health data' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search for indicators' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Topic summaries for England' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Latest release' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Releases' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });

  it('renders the prototype release route and shared shell', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GOV.UK' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Releases' })).toBeTruthy();
  });
});
