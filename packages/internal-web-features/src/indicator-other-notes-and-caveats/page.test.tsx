// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { OtherNotesAndCaveatsPage } from './page.tsx';

afterEach(cleanup);

const empty = {
  disclosureControl: '',
  disclosureControlDetail: '',
  roundingApplied: '',
  roundingDetail: '',
  caveatsNeeded: '',
  caveatsDetail: '',
  otherNotesNeeded: '',
  otherNotesDetail: '',
};

const QUESTIONS = [
  ['Has disclosure control been applied?', 'disclosureControl', 'disclosureControlDetail'],
  ['Has any rounding been applied?', 'roundingApplied', 'roundingDetail'],
  ['Are there any caveats needed?', 'caveatsNeeded', 'caveatsDetail'],
  ['Are there any other notes needed?', 'otherNotesNeeded', 'otherNotesDetail'],
] as const;

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof OtherNotesAndCaveatsPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <OtherNotesAndCaveatsPage values={empty} {...props} />
    </MemoryRouter>,
  );
}

function question(legend: string) {
  return within(screen.getByRole('group', { name: new RegExp(legend.replace('?', '\\?')) }));
}

function option(legend: string, label: string) {
  return question(legend).getByLabelText(label) as HTMLInputElement;
}

function detailsField(legend: string) {
  return question(legend).getByLabelText('Provide details') as HTMLTextAreaElement;
}

/** The block a question's Yes reveals, which holds its details field. */
function conditional(legend: string) {
  const reveal = detailsField(legend).closest('.govuk-radios__conditional');
  if (reveal === null) throw new Error('the details field is not in a conditional reveal');
  return reveal;
}

describe('OtherNotesAndCaveatsPage', () => {
  it('asks the four questions under the page heading, each a medium heading in its legend', () => {
    const { container } = renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Provide any other notes and caveats' }),
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => [heading.textContent, heading.className, heading.parentElement?.tagName]),
    ).toEqual(QUESTIONS.map(([legend]) => [legend, 'govuk-heading-m', 'LEGEND']));
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(5);
  });

  it.each(QUESTIONS)('answers "%s" with %s', (legend, name) => {
    renderPage();

    const radios = question(legend).getAllByRole('radio') as HTMLInputElement[];

    expect(radios.every((radio) => radio.name === name)).toBe(true);
    expect(radios.map((radio) => radio.value)).toEqual(
      name === 'disclosureControl' ? ['yes', 'no', 'not-applicable'] : ['yes', 'no'],
    );
  });

  it('offers "Not applicable" for disclosure control alone', () => {
    renderPage();

    expect(option('Has disclosure control been applied?', 'Not applicable').value).toBe(
      'not-applicable',
    );
    expect(screen.getAllByLabelText('Not applicable')).toHaveLength(1);
  });

  it.each(QUESTIONS)(
    'asks for the details of "%s" inside the reveal Yes controls',
    (legend, _, detail) => {
      renderPage();

      expect(detailsField(legend).getAttribute('name')).toBe(detail);
      expect(detailsField(legend).getAttribute('rows')).toBe('2');
      expect(option(legend, 'Yes').getAttribute('aria-controls')).toBe(conditional(legend).id);
    },
  );

  it('marks each reveal hidden while Yes is not chosen, which hides it only with JavaScript', () => {
    renderPage({ values: { ...empty, caveatsNeeded: 'no' } });

    for (const [legend] of QUESTIONS) {
      expect(conditional(legend).className).toContain('govuk-radios__conditional--hidden');
    }
  });

  it('reveals the details when Yes is chosen', () => {
    const legend = 'Has any rounding been applied?';
    renderPage();

    fireEvent.click(option(legend, 'Yes'));

    expect(conditional(legend).className).not.toContain('govuk-radios__conditional--hidden');
    expect(option(legend, 'Yes').getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        ...empty,
        disclosureControl: 'not-applicable',
        roundingApplied: 'no',
        caveatsNeeded: 'yes',
        caveatsDetail: 'Survey data.',
        otherNotesNeeded: 'no',
      },
    });

    expect(option('Has disclosure control been applied?', 'Not applicable').checked).toBe(true);
    expect(option('Has any rounding been applied?', 'No').checked).toBe(true);
    expect(option('Are there any caveats needed?', 'Yes').checked).toBe(true);
    expect(detailsField('Are there any caveats needed?').value).toBe('Survey data.');
    expect(option('Are there any other notes needed?', 'No').checked).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe(`Provide any other notes and caveats - ${serviceName} - GOV.UK`);
  });

  it('chooses nothing while the questions are unanswered', () => {
    renderPage();

    expect(screen.getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
  });

  it('summarises every refusal in the order the form asks, linking to each control', () => {
    renderPage({
      fieldErrors: {
        otherNotesNeeded: 'Select whether there are any other notes needed',
        disclosureControlDetail: 'Provide details of the disclosure control',
        roundingApplied: 'Select whether rounding has been applied',
      },
      values: { ...empty, disclosureControl: 'yes' },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Provide details of the disclosure control',
      'Select whether rounding has been applied',
      'Select whether there are any other notes needed',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${detailsField('Has disclosure control been applied?').id}`,
      `#${option('Has any rounding been applied?', 'Yes').id}`,
      `#${option('Are there any other notes needed?', 'Yes').id}`,
    ]);
    expect(document.title).toBe(
      `Error: Provide any other notes and caveats - ${serviceName} - GOV.UK`,
    );
  });

  it('marks an unanswered question as refused', () => {
    const { container } = renderPage({
      fieldErrors: { caveatsNeeded: 'Select whether there are any caveats needed' },
    });

    const group = screen.getByRole('group', { name: /Are there any caveats needed\?/ });

    expect(group.closest('.govuk-form-group--error')).not.toBeNull();
    expect(group.textContent).toContain('Select whether there are any caveats needed');
    expect(container.querySelectorAll('.govuk-form-group--error')).toHaveLength(1);
  });

  it('shows a details error inside the open reveal and keeps what was typed elsewhere', () => {
    const legend = 'Are there any other notes needed?';
    renderPage({
      fieldErrors: { otherNotesDetail: 'Provide details of the other notes' },
      values: {
        ...empty,
        caveatsNeeded: 'yes',
        caveatsDetail: 'Survey data.',
        otherNotesNeeded: 'yes',
      },
    });

    const error = conditional(legend).querySelector('.govuk-error-message');

    expect(conditional(legend).className).not.toContain('govuk-radios__conditional--hidden');
    expect(error?.textContent).toContain('Provide details of the other notes');
    expect(detailsField(legend).className).toContain('govuk-textarea--error');
    expect(detailsField(legend).getAttribute('aria-describedby')).toBe(error?.id);
    expect(detailsField('Are there any caveats needed?').value).toBe('Survey data.');
  });
});
