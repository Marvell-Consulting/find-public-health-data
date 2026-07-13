import { ManageDataPage } from '@fphd/internal-web-features';
import { ReleasesPage } from '@fphd/public-web-features';
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
        children: [{ path: 'manage', Component: ManageDataPage }],
      },
    ]);

    render(<Routes initialEntries={['/manage']} />);

    expect(screen.getByText('Internal')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Manage public health data' })).toBeTruthy();
  });
});
