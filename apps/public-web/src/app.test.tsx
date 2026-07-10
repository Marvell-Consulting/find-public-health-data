import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { publicRoutes } from './router';

afterEach(cleanup);

describe('public application routes', () => {
  it('renders a shared public feature route', async () => {
    const router = createMemoryRouter(publicRoutes, { initialEntries: ['/about'] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'About this service' })).toBeTruthy();
  });
});
