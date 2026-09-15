// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { SignInLandingPage } from './page';

afterEach(cleanup);

describe('SignInLandingPage', () => {
  it('offers to sign in to manage indicators', () => {
    render(
      <MemoryRouter>
        <SignInLandingPage signInHref="/sign-in?returnTo=%2Fdashboard" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign in to manage indicators' }),
    ).toBeTruthy();
    // The GOV.UK button component renders an anchor with role="button", not a plain link.
    expect(screen.getByRole('button', { name: 'Sign in' }).getAttribute('href')).toBe(
      '/sign-in?returnTo=%2Fdashboard',
    );
  });
});
