import { fakeUsersForAudience } from '@fphd/auth';
import { PublicHomePage, ReleasesPage, SignInPage, TopicsRoute } from '@fphd/public-web-features';
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
        loader: () => ({ signedIn: false }),
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
        loader: () => ({ signedIn: false }),
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GOV.UK' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Releases' })).toBeTruthy();
  });

  it('offers all fake users on the public sign-in page', () => {
    render(<SignInPage audience="public" returnTo="/" users={fakeUsersForAudience('public')} />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('links to the account when a user is signed in', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: true }),
        children: [{ index: true, Component: PublicHomePage }],
      },
    ]);

    render(<Routes initialEntries={['/']} />);

    expect((await screen.findByRole('link', { name: 'Account' })).getAttribute('href')).toBe(
      '/sign-in',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('renders the topics page as an alphabetical list of links from loader data', async () => {
    // Ordering is the repository/API's responsibility (asserted elsewhere); this fixture is
    // already alphabetical, and the page must render it in that order without reshuffling.
    const topics = [
      { slug: 'topic-a', title: 'Topic A' },
      { slug: 'topic-b', title: 'Topic B' },
    ];
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: PublicApp,
        loader: () => ({ signedIn: false }),
        children: [{ path: 'topics', Component: TopicsRoute, loader: () => topics }],
      },
    ]);

    render(<Routes initialEntries={['/topics']} />);

    expect(await screen.findByRole('heading', { name: 'Topics' })).toBeTruthy();

    const links = screen.getAllByRole('link', { name: /^Topic [AB]$/ });
    expect(links.map((link) => link.textContent)).toEqual(['Topic A', 'Topic B']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/topics/topic-a',
      '/topics/topic-b',
    ]);
  });
});
