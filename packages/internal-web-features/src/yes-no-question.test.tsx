// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { YesNoQuestion } from './yes-no-question.tsx';

afterEach(cleanup);

type Field = 'answer' | 'detail';

const LEGEND = 'Are there any caveats needed?';

function renderQuestion(props: Partial<ComponentProps<typeof YesNoQuestion<Field>>> = {}) {
  return render(
    <YesNoQuestion<Field>
      answer="answer"
      detail="detail"
      detailLabel="Provide details"
      detailRows={3}
      fieldErrors={{}}
      legend={LEGEND}
      values={{ answer: '', detail: '' }}
      {...props}
    />,
  );
}

function group() {
  return screen.getByRole('group', { name: /Are there any caveats needed\?/ });
}

function option(label: string) {
  return within(group()).getByLabelText(label) as HTMLInputElement;
}

function detailsField() {
  return within(group()).getByLabelText('Provide details') as HTMLTextAreaElement;
}

function conditional() {
  const reveal = detailsField().closest('.govuk-radios__conditional');
  if (reveal === null) throw new Error('the details field is not in a conditional reveal');
  return reveal;
}

describe('YesNoQuestion', () => {
  it('asks the question as a medium heading in its legend', () => {
    renderQuestion();

    const heading = screen.getByRole('heading', { level: 2, name: LEGEND });

    expect(heading.className).toBe('govuk-heading-m');
    expect(heading.parentElement?.tagName).toBe('LEGEND');
  });

  it('describes the question with its hint', () => {
    renderQuestion({ hint: 'The default is "© Crown copyright"' });

    const hint = within(group()).getByText('The default is "© Crown copyright"');

    expect(hint.className).toContain('govuk-hint');
    expect(group().getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('answers with Yes and No under its answer field, then any further answers', () => {
    renderQuestion({ moreOptions: [{ value: 'not-applicable', label: 'Not applicable' }] });

    const radios = within(group()).getAllByRole('radio') as HTMLInputElement[];

    expect(radios.map((radio) => [radio.name, radio.value])).toEqual([
      ['answer', 'yes'],
      ['answer', 'no'],
      ['answer', 'not-applicable'],
    ]);
    expect(radios.some((radio) => radio.checked)).toBe(false);
  });

  it('asks for the details inside the reveal Yes controls', () => {
    renderQuestion();

    expect(detailsField().getAttribute('name')).toBe('detail');
    expect(detailsField().getAttribute('rows')).toBe('3');
    expect(option('Yes').getAttribute('aria-controls')).toBe(conditional().id);
  });

  it('marks the reveal hidden while Yes is not chosen, which hides it only with JavaScript', () => {
    renderQuestion({ values: { answer: 'no', detail: '' } });

    expect(conditional().className).toContain('govuk-radios__conditional--hidden');
  });

  it('reveals the details when Yes is chosen', () => {
    renderQuestion();

    fireEvent.click(option('Yes'));

    expect(conditional().className).not.toContain('govuk-radios__conditional--hidden');
    expect(option('Yes').getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the answer and details it is given', () => {
    renderQuestion({ values: { answer: 'yes', detail: 'Survey data.' } });

    expect(option('Yes').checked).toBe(true);
    expect(detailsField().value).toBe('Survey data.');
  });

  it('marks an unanswered question as refused', () => {
    const { container } = renderQuestion({ fieldErrors: { answer: 'Select an answer' } });

    expect(group().closest('.govuk-form-group--error')).not.toBeNull();
    expect(group().textContent).toContain('Select an answer');
    expect(container.querySelectorAll('.govuk-form-group--error')).toHaveLength(1);
  });

  it('shows a details error inside the open reveal', () => {
    renderQuestion({
      fieldErrors: { detail: 'Provide details of the caveats' },
      values: { answer: 'yes', detail: '' },
    });

    const error = conditional().querySelector('.govuk-error-message');

    expect(conditional().className).not.toContain('govuk-radios__conditional--hidden');
    expect(error?.textContent).toContain('Provide details of the caveats');
    expect(detailsField().className).toContain('govuk-textarea--error');
    expect(detailsField().getAttribute('aria-describedby')).toBe(error?.id);
  });
});
