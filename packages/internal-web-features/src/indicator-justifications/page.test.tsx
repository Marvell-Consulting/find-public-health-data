// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { JustificationsPage } from './page.tsx';

afterEach(cleanup);

const empty = {
  ciMethodJustification: '',
  dataSourcesJustification: '',
  inequalitiesIncluded: '',
  hasExclusions: '',
  exclusionsDetail: '',
  automationUsed: '',
  automationDetail: '',
};

const TEXT_QUESTIONS = [
  ['Why was the confidence interval method chosen?', 'ciMethodJustification'],
  ['Why were the data sources chosen?', 'dataSourcesJustification'],
  ['What health inequalities have been included?', 'inequalitiesIncluded'],
] as const;

const EXCLUSIONS = 'Have there been any exclusions?';
const AUTOMATION = 'Have internal automation tools been used to create this indicator?';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof JustificationsPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <JustificationsPage values={empty} {...props} />
    </MemoryRouter>,
  );
}

function textarea(label: string) {
  return screen.getByLabelText(label) as HTMLTextAreaElement;
}

function question(legend: string) {
  return within(screen.getByRole('group', { name: legend }));
}

describe('JustificationsPage', () => {
  it('asks three questions in text, then about exclusions and automation', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Justifications' })).toBeTruthy();
    expect(TEXT_QUESTIONS.map(([label]) => textarea(label).name)).toEqual(
      TEXT_QUESTIONS.map(([, name]) => name),
    );
    expect(textarea(TEXT_QUESTIONS[0][0]).getAttribute('rows')).toBe('5');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([EXCLUSIONS, AUTOMATION]);
    expect(
      (screen.getAllByRole('radio') as HTMLInputElement[]).map((radio) => [
        radio.name,
        radio.value,
      ]),
    ).toEqual([
      ['hasExclusions', 'yes'],
      ['hasExclusions', 'no'],
      ['automationUsed', 'yes'],
      ['automationUsed', 'no'],
    ]);
  });

  it.each([
    [EXCLUSIONS, 'Enter why exclusions were made', 'exclusionsDetail'],
    [AUTOMATION, 'Enter details of the tools used', 'automationDetail'],
  ])('asks under the Yes of "%s" for "%s"', (legend, label, name) => {
    renderPage();

    const details = question(legend).getByLabelText(label) as HTMLTextAreaElement;

    expect(details.name).toBe(name);
    expect(details.getAttribute('rows')).toBe('5');
    expect(details.closest('.govuk-radios__conditional')?.id).toBe(
      question(legend).getByLabelText('Yes').getAttribute('aria-controls'),
    );
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        ciMethodJustification: 'Standard.',
        dataSourcesJustification: 'National.',
        inequalitiesIncluded: 'Deciles.',
        hasExclusions: 'yes',
        exclusionsDetail: 'Small areas.',
        automationUsed: 'no',
        automationDetail: '',
      },
    });

    expect(textarea(TEXT_QUESTIONS[2][0]).value).toBe('Deciles.');
    expect((question(EXCLUSIONS).getByLabelText('Yes') as HTMLInputElement).checked).toBe(true);
    expect(
      (question(EXCLUSIONS).getByLabelText('Enter why exclusions were made') as HTMLTextAreaElement)
        .value,
    ).toBe('Small areas.');
    expect((question(AUTOMATION).getByLabelText('No') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe(`Justifications - ${serviceName} - GOV.UK`);
  });

  it('summarises every refusal in the order the form asks, linking to each control', () => {
    renderPage({
      fieldErrors: {
        automationUsed: 'Select whether internal automation tools have been used',
        exclusionsDetail: 'Enter why exclusions were made',
        dataSourcesJustification: 'Enter why the data sources were chosen',
      },
      values: { ...empty, hasExclusions: 'yes' },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Enter why the data sources were chosen',
      'Enter why exclusions were made',
      'Select whether internal automation tools have been used',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${textarea(TEXT_QUESTIONS[1][0]).id}`,
      `#${question(EXCLUSIONS).getByLabelText('Enter why exclusions were made').id}`,
      `#${question(AUTOMATION).getByLabelText('Yes').id}`,
    ]);
    expect(document.title).toBe(`Error: Justifications - ${serviceName} - GOV.UK`);
  });
});
