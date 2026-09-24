// @vitest-environment jsdom
import { firstRadioId, Radios, serviceName, Textarea } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { IndicatorSectionForm } from './indicator-section-form.tsx';

afterEach(cleanup);

type Props = Parameters<typeof IndicatorSectionForm<'answer' | 'choice'>>[0];

// Radios as well as a textarea, because GOV.UK links a radios error to its first option.
function renderForm(props: Partial<Props> = {}) {
  const fieldErrors = props.fieldErrors ?? {};

  return render(
    <MemoryRouter>
      <IndicatorSectionForm
        fields={['answer', 'choice']}
        fieldErrors={fieldErrors}
        fieldIds={{ choice: firstRadioId('choice') }}
        title="A section"
        {...props}
      >
        <Textarea error={fieldErrors.answer} label="An answer" name="answer" />
        <Radios
          {...(fieldErrors.choice === undefined ? {} : { error: fieldErrors.choice })}
          label="A choice"
          name="choice"
          options={[
            { label: 'One', value: 'one' },
            { label: 'Two', value: 'two' },
          ]}
        />
      </IndicatorSectionForm>
    </MemoryRouter>,
  );
}

describe('IndicatorSectionForm', () => {
  it('heads the page with its title and names the document after it', () => {
    renderForm();

    expect(screen.getByRole('heading', { level: 1, name: 'A section' })).toBeTruthy();
    expect(document.title).toBe(`A section - ${serviceName} - GOV.UK`);
  });

  it('adds no heading when the question is the heading', () => {
    renderForm({ questionIsHeading: true });

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(document.title).toBe(`A section - ${serviceName} - GOV.UK`);
  });

  it('continues with a form that posts back to its own page', () => {
    const { container } = renderForm();
    const form = container.querySelector('form');

    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBeNull();
    expect(within(form as HTMLElement).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('shows no summary and a plain title while nothing is refused', () => {
    renderForm();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('summarises refusals in field order and starts the title with "Error: "', () => {
    renderForm({ fieldErrors: { choice: 'Choose one', answer: 'Enter an answer' } });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['Enter an answer', 'Choose one']);
    expect(document.title).toBe(`Error: A section - ${serviceName} - GOV.UK`);
  });

  it("links a field's error to its input, and a radios error to the first option", () => {
    renderForm({ fieldErrors: { answer: 'Enter an answer', choice: 'Choose one' } });

    const summary = within(screen.getByRole('alert'));
    const answer = screen.getByLabelText('An answer');
    const firstOption = screen.getByLabelText('One');

    expect(summary.getByRole('link', { name: 'Enter an answer' }).getAttribute('href')).toBe(
      `#${answer.id}`,
    );
    expect(summary.getByRole('link', { name: 'Choose one' }).getAttribute('href')).toBe(
      `#${firstOption.id}`,
    );
  });
});
