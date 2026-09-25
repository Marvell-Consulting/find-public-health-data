// @vitest-environment jsdom
import type { TagOptions } from '@fphd/internal-api-features/contract';
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { addIntent, removeIntent } from '../list-form.ts';
import type { TaggingPageValues } from './form.ts';
import { TaggingPage } from './page.tsx';

afterEach(cleanup);

const TITLE = 'Add tags for this indicator';

const alcohol = '019fa38f-073f-764e-9ac6-1c4d03b10001';
const cancer = '019fa38f-073f-764e-9ac6-1c4d03b10002';
const outcome = '019fa38f-073f-764e-9ac6-1c4d03b10003';
const gambling = '019fa38f-073f-764e-9ac6-1c4d03b10004';
const healthyChild = '019fa38f-073f-764e-9ac6-1c4d03b10005';

const options: TagOptions = {
  topics: [
    { id: alcohol, name: 'Alcohol' },
    { id: cancer, name: 'Cancer' },
  ],
  indicatorTypes: [{ id: outcome, name: 'Outcome' }],
  riskFactors: [{ id: gambling, name: 'Gambling' }],
  frameworks: [{ id: healthyChild, name: 'Healthy Child' }],
};

const empty: TaggingPageValues = {
  topicIds: [],
  indicatorTypeIds: [],
  hasRiskFactor: '',
  riskFactorIds: [],
  hasFramework: '',
  frameworkIds: [],
  addTopic: '',
  addIndicatorType: '',
  addRiskFactor: '',
  addFramework: '',
};

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof TaggingPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TaggingPage formError={undefined} options={options} values={empty} {...props} />
    </MemoryRouter>,
  );
}

function select(label: string) {
  return screen.getByLabelText(label, { exact: true }) as HTMLSelectElement;
}

function hidden(name: string) {
  return [...document.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)];
}

describe('TaggingPage', () => {
  it('heads the page and asks the two questions as groups', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
    expect(document.title).toBe(`${TITLE} - ${serviceName} - GOV.UK`);
    expect(
      screen.getByRole('group', { name: 'Does this indicator include a risk factor?' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Is this indicator part of a framework or programme?' }),
    ).toBeTruthy();
  });

  it('offers every tag of each list in a select with its own Add button', () => {
    renderPage();

    expect([...select('Select a topic').options].map((option) => option.text)).toEqual([
      'Select',
      'Alcohol',
      'Cancer',
    ]);
    expect(select('Select an indicator type').name).toBe('addIndicatorType');
    expect(select('Select a risk factor').name).toBe('addRiskFactor');
    expect(select('Select a framework or programme').name).toBe('addFramework');
    expect(
      screen
        .getAllByRole('button', { name: /^Add / })
        .map((button) => [button.textContent, (button as HTMLButtonElement).value]),
    ).toEqual([
      ['Add topic', addIntent('topicIds')],
      ['Add indicator type', addIntent('indicatorTypeIds')],
      ['Add risk factor', addIntent('riskFactorIds')],
      ['Add framework or programme', addIntent('frameworkIds')],
    ]);
  });

  it('lists the tags added, each carried in the form with a Remove button naming it', () => {
    renderPage({ values: { ...empty, topicIds: [cancer, alcohol], hasRiskFactor: 'yes' } });

    expect(hidden('topicIds').map((input) => input.value)).toEqual([cancer, alcohol]);
    const remove = screen.getByRole('button', { name: 'Remove topic Alcohol' });
    expect((remove as HTMLButtonElement).value).toBe(removeIntent(1, 'topicIds'));
  });

  it('leaves out a tag the page no longer offers', () => {
    const gone = '019fa38f-073f-764e-9ac6-1c4d03b10999';
    renderPage({ values: { ...empty, topicIds: [gone, alcohol] } });

    expect(hidden('topicIds').map((input) => input.value)).toEqual([alcohol]);
    expect(
      (screen.getByRole('button', { name: 'Remove topic Alcohol' }) as HTMLButtonElement).value,
    ).toBe(removeIntent(0, 'topicIds'));
  });

  it('keeps a tag chosen but not yet added in its select', () => {
    renderPage({ values: { ...empty, addTopic: cancer } });

    expect(select('Select a topic').value).toBe(cancer);
  });

  it('shows a refused list on the select that adds to it, linked from the summary', () => {
    renderPage({
      fieldErrors: {
        topicIds: 'Select at least one topic',
        hasRiskFactor: 'Select whether this indicator includes a risk factor',
      },
    });

    const summary = screen.getByRole('alert');
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Select at least one topic', '#addTopic-input'],
      ['Select whether this indicator includes a risk factor', '#hasRiskFactor-radio-0'],
    ]);
    expect(select('Select a topic').getAttribute('aria-describedby')).toBe('addTopic-error');
  });

  it('continues when Enter is pressed rather than pressing the first Add', () => {
    renderPage();

    const [first] = document.querySelectorAll(
      'form button[type="submit"], form button:not([type])',
    );
    expect(first?.textContent).toBe('Continue');
  });
});
