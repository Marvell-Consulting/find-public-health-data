// @vitest-environment jsdom
import {
  type AgeRangeFormValues,
  ageRangeFieldName,
  MAX_AGE_RANGES,
  type SexAndAgesFormValues,
} from '@fphd/internal-api-features/contract';
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { SexAndAgesPage } from './page.tsx';

afterEach(cleanup);

const TITLE = 'What are the sexes and ages included in this indicator?';

const blank: AgeRangeFormValues = {
  lowerLimit: '',
  lowerLimitUnit: '',
  upperLimit: '',
  upperLimitUnit: '',
};
const sixteenPlus = { ...blank, lowerLimit: '16', lowerLimitUnit: 'years' };
const underFive = { ...blank, upperLimit: '4', upperLimitUnit: 'months' };

const empty: SexAndAgesFormValues = {
  sexes: [],
  ageType: '',
  ageRanges: [blank],
  specificAge: '',
  specificAgeUnit: '',
  ageOtherDetail: '',
};

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof SexAndAgesPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SexAndAgesPage values={empty} {...props} />
    </MemoryRouter>,
  );
}

function field(label: string) {
  return screen.getByLabelText(label, { exact: true }) as HTMLInputElement | HTMLSelectElement;
}

function buttons(name: string | RegExp) {
  return screen.queryAllByRole('button', { name }) as HTMLButtonElement[];
}

describe('SexAndAgesPage', () => {
  it('heads the page with the question and asks the two questions as groups', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
    expect(document.title).toBe(`${TITLE} - ${serviceName} - GOV.UK`);
    expect(screen.getByRole('group', { name: 'Select sexes included' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Select age type' })).toBeTruthy();
  });

  it('offers each sex, ticking those answered', () => {
    renderPage({ values: { ...empty, sexes: ['persons', 'males'] } });

    const boxes = within(screen.getByRole('group', { name: 'Select sexes included' })).getAllByRole(
      'checkbox',
    ) as HTMLInputElement[];

    expect(
      boxes.map((box) => [box.name, box.value, box.labels?.[0]?.textContent, box.checked]),
    ).toEqual([
      ['sexes', 'persons', 'Persons', true],
      ['sexes', 'females', 'Females', false],
      ['sexes', 'males', 'Males', true],
    ]);
  });

  it('offers each age type, choosing the one answered', () => {
    renderPage({ values: { ...empty, ageType: 'specific' } });

    const radios = within(screen.getByRole('group', { name: 'Select age type' })).getAllByRole(
      'radio',
    ) as HTMLInputElement[];

    expect(
      radios.map((radio) => [radio.value, radio.labels?.[0]?.textContent, radio.checked]),
    ).toEqual([
      ['all', 'All ages', false],
      ['range', 'Age range', false],
      ['specific', 'Specific age', true],
      ['other', 'Other', false],
    ]);
  });

  it('asks each limit as a number and a period, with the periods in order', () => {
    renderPage({ values: { ...empty, ageRanges: [sixteenPlus] } });

    const lower = field('Lower limit') as HTMLInputElement;
    const lowerPeriod = field('Periods for lower limit') as HTMLSelectElement;

    expect([lower.name, lower.value, lower.inputMode]).toEqual([
      ageRangeFieldName(0, 'lowerLimit'),
      '16',
      'numeric',
    ]);
    expect([lowerPeriod.name, lowerPeriod.value]).toEqual([
      ageRangeFieldName(0, 'lowerLimitUnit'),
      'years',
    ]);
    expect([...lowerPeriod.options].map((option) => [option.value, option.text])).toEqual([
      ['', 'Select'],
      ['days', 'days'],
      ['weeks', 'weeks'],
      ['months', 'months'],
      ['years', 'years'],
    ]);
    expect(field('Upper limit').name).toBe(ageRangeFieldName(0, 'upperLimit'));
    expect(field('Periods for upper limit').name).toBe(ageRangeFieldName(0, 'upperLimitUnit'));
  });

  it('numbers the limits from the second range, which alone can be removed', () => {
    renderPage({ values: { ...empty, ageType: 'range', ageRanges: [sixteenPlus, underFive] } });

    expect(field('Upper limit 2').value).toBe('4');
    expect(field('Periods for upper limit 2').value).toBe('months');
    expect(buttons(/^Remove range/).map((button) => [button.textContent, button.value])).toEqual([
      ['Remove range 2', 'remove-1'],
    ]);
  });

  it('offers another range until as many as a draft may hold', () => {
    renderPage();
    expect(buttons('Add another range').map((button) => [button.name, button.value])).toEqual([
      ['intent', 'add'],
    ]);
    cleanup();

    renderPage({
      values: { ...empty, ageRanges: Array.from({ length: MAX_AGE_RANGES }, () => sixteenPlus) },
    });
    expect(buttons('Add another range')).toHaveLength(0);
  });

  it('asks for a specific age and its period, and for other ages in words', () => {
    renderPage({
      values: { ...empty, specificAge: '5', specificAgeUnit: 'weeks', ageOtherDetail: 'Year 6' },
    });

    expect(field('Age').value).toBe('5');
    expect(field('Periods for age').value).toBe('weeks');
    expect(screen.getByRole('textbox', { name: 'Other' })).toHaveProperty('value', 'Year 6');
  });

  it('lets Enter in a field continue rather than add or remove a range', () => {
    const { container } = renderPage({ values: { ...empty, ageRanges: [sixteenPlus, blank] } });

    const first = container.querySelector('form button');

    expect(first?.textContent).toBe('Continue');
    expect(first?.getAttribute('name')).toBeNull();
  });

  it('summarises refusals in the order the page asks, linking each to its field', () => {
    renderPage({
      values: { ...empty, ageType: 'range', ageRanges: [blank, blank] },
      fieldErrors: {
        ageOtherDetail: 'Enter the ages included',
        [ageRangeFieldName(1, 'lowerLimit')]:
          'You must enter at least a lower or upper limit for range 2',
        sexes: 'Select sexes included',
        [ageRangeFieldName(0, 'upperLimitUnit')]: 'Select the periods for the upper limit',
      },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Select sexes included', `#${screen.getByLabelText('Persons').id}`],
      ['Select the periods for the upper limit', `#${field('Periods for upper limit').id}`],
      [
        'You must enter at least a lower or upper limit for range 2',
        `#${field('Lower limit 2').id}`,
      ],
      ['Enter the ages included', `#${screen.getByRole('textbox', { name: 'Other' }).id}`],
    ]);
    expect(document.title).toBe(`Error: ${TITLE} - ${serviceName} - GOV.UK`);
  });

  it('shows a refusal of the ranges as a whole at the first range', () => {
    renderPage({ fieldErrors: { ageRanges: 'You cannot add more than 20 ranges' } });

    const lower = field('Lower limit');

    expect(within(screen.getByRole('alert')).getByRole('link').getAttribute('href')).toBe(
      `#${lower.id}`,
    );
    expect(lower.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      document.getElementById(lower.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('You cannot add more than 20 ranges');
  });
});
