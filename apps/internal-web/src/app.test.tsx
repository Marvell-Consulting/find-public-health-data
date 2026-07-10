import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { internalRoutes } from './router';

afterEach(cleanup);

describe('internal application routes', () => {
  it('includes the shared public routes', async () => {
    const router = createMemoryRouter(internalRoutes, { initialEntries: ['/about'] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'About this service' })).toBeTruthy();
  });

  it('includes internal-only routes', async () => {
    const router = createMemoryRouter(internalRoutes, { initialEntries: ['/manage'] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Manage public health data' })).toBeTruthy();
  });
});
