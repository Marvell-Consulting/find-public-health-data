// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { UpdateFrequencyPage } from './page.tsx';

afterEach(cleanup);

const QUESTION = 'How often will this indicator be updated?';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof UpdateFrequencyPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <UpdateFrequencyPage values={{ updateFrequency: '' }} {...props} />
    </MemoryRouter>,
  );
}

function option(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('UpdateFrequencyPage', () => {
  it('asks the question as the page heading, which also names the group of options', () => {
    renderPage();

    const heading = screen.getByRole('heading', { level: 1, name: QUESTION });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.closest('legend')).not.toBeNull();
    expect(screen.getByRole('group', { name: QUESTION })).toBeTruthy();
    expect(document.title).toBe(`${QUESTION} - ${serviceName} - GOV.UK`);
  });

  it('offers the frequencies, then "or", then that the indicator will no longer be updated', () => {
    const { container } = renderPage();

    const radios = within(screen.getByRole('group')).getAllByRole('radio') as HTMLInputElement[];
    const items = [...container.querySelectorAll('.govuk-radios > *')];

    expect(radios.map((radio) => radio.labels?.[0]?.textContent)).toEqual([
      'Monthly',
      'Quarterly',
      'Annually',
      'Every 2 years',
      'No fixed frequency',
      'This indicator will no longer be updated',
    ]);
    expect(radios.map((radio) => radio.value)).toEqual([
      'monthly',
      'quarterly',
      'annually',
      'every-2-years',
      'no-fixed-frequency',
      'no-longer-updated',
    ]);
    expect(radios.every((radio) => radio.name === 'updateFrequency' && !radio.checked)).toBe(true);
    expect(items[5]?.className).toBe('govuk-radios__divider');
    expect(items[5]?.textContent).toBe('or');
  });

  it('shows the frequency it is given, so a draft can be revisited', () => {
    renderPage({ values: { updateFrequency: 'no-longer-updated' } });

    expect(option('This indicator will no longer be updated').checked).toBe(true);
    expect(option('Monthly').checked).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('links the refusal to the first option and describes the options with it', () => {
    const { container } = renderPage({
      fieldErrors: { updateFrequency: 'Select how often this indicator will be updated' },
    });

    const link = within(screen.getByRole('alert')).getByRole('link');
    const error = container.querySelector('.govuk-error-message');

    expect(link.textContent).toBe('Select how often this indicator will be updated');
    expect(link.getAttribute('href')).toBe(`#${option('Monthly').id}`);
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(error?.id);
    expect(container.querySelectorAll('.govuk-form-group--error')).toHaveLength(1);
    expect(document.title).toBe(`Error: ${QUESTION} - ${serviceName} - GOV.UK`);
  });
});
