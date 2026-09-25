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
        formError={undefined}
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

  it('offers one Continue, which Enter in a field presses when no other button comes first', () => {
    const { container } = renderForm();
    const buttons = container.querySelectorAll('form button');

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Continue');
  });

  it("puts a hidden Continue first when asked, for Enter to press in place of the form's own buttons", () => {
    const { container } = renderForm({ continueOnEnter: true });
    const [first, ...others] = container.querySelectorAll('form button');

    expect(first?.textContent).toBe('Continue');
    expect(first?.getAttribute('type')).toBe('submit');
    expect(first?.getAttribute('name')).toBeNull();
    expect(first?.getAttribute('tabindex')).toBe('-1');
    expect(first?.getAttribute('aria-hidden')).toBe('true');
    expect(first?.className).toBe('govuk-visually-hidden');
    // Out of the accessibility tree, so the visible Continue is the only one announced.
    expect(screen.getAllByRole('button', { name: 'Continue' })).toEqual(
      others.filter((button) => button.textContent === 'Continue'),
    );
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

  it('summarises a refusal naming no field as an unlinked message, with an "Error: " title', () => {
    renderForm({ formError: 'Your answers could not be saved. Try again.' });

    const summary = within(screen.getByRole('alert'));

    expect(summary.getByText('Your answers could not be saved. Try again.')).toBeTruthy();
    expect(summary.queryAllByRole('link')).toEqual([]);
    expect(document.querySelector('.govuk-form-group--error')).toBeNull();
    expect(document.title).toBe(`Error: A section - ${serviceName} - GOV.UK`);
  });

  it('summarises a message given on several fields once, linking to the first', () => {
    renderForm({ fieldErrors: { answer: 'Answer both', choice: 'Answer both' } });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Answer both', '#answer-input'],
    ]);
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
