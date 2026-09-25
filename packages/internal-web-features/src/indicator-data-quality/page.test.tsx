// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DataQualityPage } from './page.tsx';

afterEach(cleanup);

const QUESTION = 'Are there any data quality issues with this indicator?';
const HINT =
  "If yes, you should ensure these issues are clearly explained in the 'Caveats' section.";
const REFUSAL = 'Select whether there are any data quality issues with this indicator';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof DataQualityPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <DataQualityPage values={{ dataQualityIssues: '' }} {...props} />
    </MemoryRouter>,
  );
}

function option(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('DataQualityPage', () => {
  it('asks the question as the page heading, which also names the group of options', () => {
    renderPage();

    const heading = screen.getByRole('heading', { level: 1, name: QUESTION });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.closest('legend')).not.toBeNull();
    expect(screen.getByRole('group', { name: QUESTION })).toBeTruthy();
    expect(document.title).toBe(`${QUESTION} - ${serviceName} - GOV.UK`);
  });

  it('describes the options with the reminder to explain the issues under caveats', () => {
    renderPage();

    const hint = screen.getByText(HINT);

    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(hint.id);
    expect(within(hint).queryByRole('link')).toBeNull();
  });

  it('offers Yes then No, neither chosen', () => {
    renderPage();

    const radios = within(screen.getByRole('group')).getAllByRole('radio') as HTMLInputElement[];

    expect(radios.map((radio) => radio.labels?.[0]?.textContent)).toEqual(['Yes', 'No']);
    expect(radios.map((radio) => radio.value)).toEqual(['yes', 'no']);
    expect(radios.every((radio) => radio.name === 'dataQualityIssues' && !radio.checked)).toBe(
      true,
    );
  });

  it('shows the answer it is given, so a draft can be revisited', () => {
    renderPage({ values: { dataQualityIssues: 'no' } });

    expect(option('No').checked).toBe(true);
    expect(option('Yes').checked).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('links the refusal to the first option and describes the options with it', () => {
    const { container } = renderPage({ fieldErrors: { dataQualityIssues: REFUSAL } });

    const link = within(screen.getByRole('alert')).getByRole('link');
    const error = container.querySelector('.govuk-error-message');
    const describedBy = screen.getByRole('group').getAttribute('aria-describedby')?.split(' ');

    expect(link.textContent).toBe(REFUSAL);
    expect(link.getAttribute('href')).toBe(`#${option('Yes').id}`);
    expect(describedBy).toContain(error?.id);
    expect(container.querySelectorAll('.govuk-form-group--error')).toHaveLength(1);
    expect(document.title).toBe(`Error: ${QUESTION} - ${serviceName} - GOV.UK`);
  });
});
