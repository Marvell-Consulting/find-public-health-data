// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { IndicatorWithdrawalPage } from './page.tsx';

afterEach(cleanup);

const ID = '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/publish/indicators/${ID}/withdraw-submission`]}>
      <IndicatorWithdrawalPage id={ID} submissionNumber={2} />
    </MemoryRouter>,
  );
}

describe('IndicatorWithdrawalPage', () => {
  it('asks the publisher to confirm, saying what withdrawing does', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Are you sure you want to withdraw this submission?',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The indicator will return to draft and must be submitted again for approval.',
      ),
    ).toBeTruthy();
  });

  it('withdraws the submission shown by posting its number', () => {
    renderPage();

    const button = screen.getByRole('button', { name: 'Withdraw submission' });
    const form = button.closest('form');
    expect(button.className).toContain('govuk-button--warning');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe(`/publish/indicators/${ID}/withdraw-submission`);
    expect(form?.querySelector<HTMLInputElement>('input[name="submissionNumber"]')?.value).toBe(
      '2',
    );
  });

  it('lets the publisher cancel, back to the overview', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
      `/dashboard/indicators/${ID}`,
    );
  });
});
