// @vitest-environment jsdom
import { ENTER_POPULATION } from '@fphd/internal-api-features/contract';
import { serviceName } from '@fphd/ui';
import { UNIT_IDS, VALUE_TYPE_IDS } from '@fphd/utils/value-type-and-unit';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ValueTypeAndUnitsPage } from './page.tsx';

afterEach(() => {
  cleanup();
  // The server-rendered cases write the body directly, which cleanup does not know about.
  document.body.innerHTML = '';
});

const TITLE = 'What are the value type and units used in this indicator?';

const empty = {
  valueTypeId: '',
  standardPopulation: '',
  standardPopulationOther: '',
  referencePopulation: '',
  unitId: '',
  unitDetail: '',
};

const STANDARD_POPULATION = 'What standard population has been used?';

const VALUE_TYPES = [
  { id: '01a0d8a5-3ca2-7315-bfca-96c8c77cad18', name: 'Crude rate' },
  { id: VALUE_TYPE_IDS.directlyStandardisedRate, name: 'Directly standardised rate' },
  {
    id: VALUE_TYPE_IDS.indirectlyStandardisedProportion,
    name: 'Indirectly standardised proportion',
  },
  { id: VALUE_TYPE_IDS.indirectlyStandardisedRatio, name: 'Indirectly standardised ratio' },
];

const UNITS = [
  { id: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9', name: 'per 100,000' },
  { id: UNIT_IDS.noUnit, name: 'No unit' },
  { id: UNIT_IDS.other, name: 'Other' },
];

type Props = Parameters<typeof ValueTypeAndUnitsPage>[0];

function page(props: Partial<Props>) {
  // The error summary's links read router state, so the page renders inside a router.
  return (
    <MemoryRouter>
      <ValueTypeAndUnitsPage units={UNITS} values={empty} valueTypes={VALUE_TYPES} {...props} />
    </MemoryRouter>
  );
}

/** Rendered and hydrated, as a browser running JavaScript has it. */
function renderPage(props: Partial<Props> = {}) {
  return render(page(props));
}

/** The server's HTML alone, as a browser without JavaScript has it. */
function renderWithoutJavaScript(props: Partial<Props> = {}) {
  document.body.innerHTML = renderToString(page(props));
}

function valueTypeSelect() {
  return screen.getByLabelText('Select value type') as HTMLSelectElement;
}

function unitSelect() {
  return screen.getByLabelText('Select units') as HTMLSelectElement;
}

function chooseValueType(id: string) {
  fireEvent.change(valueTypeSelect(), { target: { value: id } });
}

function chooseUnit(id: string) {
  fireEvent.change(unitSelect(), { target: { value: id } });
}

function shown(element: HTMLElement) {
  return element.closest('[hidden]') === null;
}

// Found even when hidden, which the role query otherwise skips.
function standardPopulationQuestion() {
  return screen.getByRole('group', { name: STANDARD_POPULATION, hidden: true });
}

function referencePopulation() {
  return document.getElementById('referencePopulation-input') as HTMLInputElement;
}

function standardPopulationOther() {
  return document.getElementById('standardPopulationOther-input') as HTMLInputElement;
}

function unitDetail() {
  return screen.getByLabelText('Enter unit') as HTMLInputElement;
}

/** The text of whatever describes this control. */
function description(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent)
    .join(' ');
}

function optionsOf(select: HTMLSelectElement) {
  return [...select.options].map((option) => [option.value, option.text]);
}

describe('ValueTypeAndUnitsPage', () => {
  it('offers the value types and units it is given, in order, after an empty choice', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
    expect(valueTypeSelect().getAttribute('name')).toBe('valueTypeId');
    expect(optionsOf(valueTypeSelect())).toEqual([
      ['', 'Select'],
      ...VALUE_TYPES.map(({ id, name }) => [id, name]),
    ]);
    expect(unitSelect().getAttribute('name')).toBe('unitId');
    expect(optionsOf(unitSelect())).toEqual([
      ['', 'Select'],
      ...UNITS.map(({ id, name }) => [id, name]),
    ]);
  });

  describe('with JavaScript', () => {
    it('asks nothing more until a value type and unit are chosen', () => {
      renderPage();

      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(referencePopulation())).toBe(false);
      expect(shown(unitDetail())).toBe(false);
    });

    it('asks a directly standardised rate for its standard population', () => {
      renderPage();

      chooseValueType(VALUE_TYPE_IDS.directlyStandardisedRate);

      expect(shown(standardPopulationQuestion())).toBe(true);
      expect(
        within(standardPopulationQuestion())
          .getAllByRole('radio', { hidden: true })
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['esp-2013', 'other']);
      expect(screen.getByLabelText('2013 European Standard Population')).toBeTruthy();
      expect(shown(referencePopulation())).toBe(false);
    });

    it.each(VALUE_TYPES.slice(2))('asks an $name for its reference population alone', ({ id }) => {
      renderPage();

      chooseValueType(id);

      expect(shown(referencePopulation())).toBe(true);
      expect(shown(standardPopulationQuestion())).toBe(false);
    });

    it('asks nothing more of any other value type', () => {
      renderPage();

      chooseValueType('01a0d8a5-3ca2-7315-bfca-96c8c77cad18');

      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(referencePopulation())).toBe(false);
    });

    it('asks an other unit for its name', () => {
      renderPage();

      chooseUnit(UNIT_IDS.other);

      expect(shown(unitDetail())).toBe(true);

      chooseUnit(UNIT_IDS.noUnit);

      expect(shown(unitDetail())).toBe(false);
    });

    it('reveals the name of an other standard population under Other', () => {
      renderPage({ values: { ...empty, valueTypeId: VALUE_TYPE_IDS.directlyStandardisedRate } });

      const conditional = standardPopulationOther().closest('.govuk-radios__conditional');

      expect(conditional?.className).toContain('govuk-radios__conditional--hidden');

      fireEvent.click(screen.getByLabelText('Other'));

      expect(conditional?.className).not.toContain('govuk-radios__conditional--hidden');
    });

    it('follows choices made before the page was hydrated', () => {
      const container = document.createElement('div');
      container.innerHTML = renderToString(page({}));
      document.body.append(container);
      const [valueType, unit] = container.querySelectorAll('select');
      if (valueType === undefined || unit === undefined) throw new Error('no selects');
      valueType.value = VALUE_TYPE_IDS.indirectlyStandardisedRatio;
      unit.value = UNIT_IDS.other;

      render(page({}), { container, hydrate: true });

      expect(shown(referencePopulation())).toBe(true);
      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(unitDetail())).toBe(true);
    });

    it('drops the hints that name the choice each follow-up is for', () => {
      renderPage();

      expect(screen.queryByText(/Only needed for/)).toBeNull();
    });
  });

  describe('without JavaScript', () => {
    it('shows every follow-up, hinting at the choice each is for', () => {
      renderWithoutJavaScript();

      expect(shown(standardPopulationQuestion())).toBe(true);
      expect(shown(referencePopulation())).toBe(true);
      expect(shown(unitDetail())).toBe(true);
      expect(
        within(standardPopulationQuestion()).getByText(
          'Only needed for Directly standardised rate',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Only needed for Indirectly standardised proportion or Indirectly standardised ratio',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Only needed for Other units')).toBeTruthy();
    });

    it('tells the two population boxes apart by their hints', () => {
      renderWithoutJavaScript();

      expect(screen.getAllByLabelText(ENTER_POPULATION).map(description)).toEqual([
        'Only needed for Other standard populations',
        'Only needed for Indirectly standardised proportion or Indirectly standardised ratio',
      ]);
    });
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        ...empty,
        valueTypeId: VALUE_TYPE_IDS.directlyStandardisedRate,
        standardPopulation: 'other',
        standardPopulationOther: 'England 2021',
        unitId: UNIT_IDS.other,
        unitDetail: 'people',
      },
    });

    expect(valueTypeSelect().value).toBe(VALUE_TYPE_IDS.directlyStandardisedRate);
    expect((screen.getByLabelText('Other') as HTMLInputElement).checked).toBe(true);
    expect(standardPopulationOther().value).toBe('England 2021');
    expect(unitSelect().value).toBe(UNIT_IDS.other);
    expect(unitDetail().value).toBe('people');
    expect(document.title).toBe(`${TITLE} - ${serviceName} - GOV.UK`);
  });

  it('summarises every refusal in the order the form asks, linking to each field', () => {
    renderPage({
      values: { ...empty, valueTypeId: VALUE_TYPE_IDS.directlyStandardisedRate },
      fieldErrors: {
        unitId: 'Select the units',
        standardPopulation: 'Select the standard population used',
      },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Select the standard population used',
      'Select the units',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${screen.getByLabelText('2013 European Standard Population').id}`,
      `#${unitSelect().id}`,
    ]);
    expect(document.title).toBe(`Error: ${TITLE} - ${serviceName} - GOV.UK`);
  });

  it('marks a refused reference population and links to it', () => {
    const { container } = renderPage({
      values: { ...empty, valueTypeId: VALUE_TYPE_IDS.indirectlyStandardisedRatio },
      fieldErrors: { referencePopulation: ENTER_POPULATION },
    });

    const error = container.querySelector('.govuk-error-message');
    const link = within(screen.getByRole('alert')).getByRole('link');

    expect(shown(referencePopulation())).toBe(true);
    expect(referencePopulation().className).toContain('govuk-input--error');
    expect(referencePopulation().getAttribute('aria-describedby')).toBe(error?.id);
    expect(link.getAttribute('href')).toBe(`#${referencePopulation().id}`);
  });

  it('keeps the width the prototype gives the unit name', () => {
    renderPage();

    expect(unitDetail().className).toContain('govuk-input--width-20');
  });
});
