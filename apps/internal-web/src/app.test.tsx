import { fakeUsersForAudience } from '@fphd/auth';
import { ManageDataPage } from '@fphd/internal-web-features';
import { ReleasesPage, SignInPage } from '@fphd/public-web-features';
import { cleanup, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import InternalApp from './root';

afterEach(cleanup);

describe('internal application routes', () => {
  it('includes the shared public routes', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: InternalApp,
        loader: () => ({ canManage: false }),
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(await screen.findByRole('heading', { name: 'Releases' })).toBeTruthy();
  });

  it('includes internal-only routes', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: InternalApp,
        loader: () => ({ canManage: true }),
        children: [{ path: 'manage', Component: ManageDataPage }],
      },
    ]);

    render(<Routes initialEntries={['/manage']} />);

    expect(await screen.findByText('Internal')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Manage public health data' })).toBeTruthy();
  });

  it('offers only internal fake users on the internal sign-in page', () => {
    render(
      <SignInPage
        audience="internal"
        returnTo="/manage"
        users={fakeUsersForAudience('internal')}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Alex Morgan')).toBeNull();
    expect(screen.getByText('Sam Taylor')).toBeTruthy();
    expect(screen.getByText('Riley Singh')).toBeTruthy();
  });

  it('hides data management from internal viewers', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: InternalApp,
        loader: () => ({ canManage: false }),
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(await screen.findByRole('heading', { name: 'Releases' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Manage data' })).toBeNull();
  });

  it('shows data management to internal publishers', async () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: InternalApp,
        loader: () => ({ canManage: true }),
        children: [{ path: 'releases', Component: ReleasesPage }],
      },
    ]);

    render(<Routes initialEntries={['/releases']} />);

    expect(await screen.findByRole('link', { name: 'Manage data' })).toBeTruthy();
  });
});
