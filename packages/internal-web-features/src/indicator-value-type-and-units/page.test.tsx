// @vitest-environment jsdom
import { ENTER_POPULATION } from '@fphd/internal-api-features/contract';
import { serviceName } from '@fphd/ui';
import { UNITS, VALUE_TYPES } from '@fphd/utils/value-type-and-unit';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { VALUE_TYPE_AND_UNITS_TITLE, ValueTypeAndUnitsPage } from './page.tsx';

afterEach(() => {
  cleanup();
  // The server-rendered cases write the body directly, which cleanup does not know about.
  document.body.innerHTML = '';
});

const empty = {
  valueTypeId: '',
  standardPopulation: '',
  standardPopulationOther: '',
  referencePopulation: '',
  unitId: '',
  unitOther: '',
};

const STANDARD_POPULATION = 'What standard population has been used?';

type Props = Parameters<typeof ValueTypeAndUnitsPage>[0];

function page(props: Partial<Props>) {
  // The error summary's links read router state, so the page renders inside a router.
  return (
    <MemoryRouter>
      <ValueTypeAndUnitsPage values={empty} {...props} />
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

function unitOther() {
  return screen.getByLabelText('Enter unit') as HTMLInputElement;
}

function optionsOf(select: HTMLSelectElement) {
  return [...select.options].map((option) => [option.value, option.text]);
}

describe('ValueTypeAndUnitsPage', () => {
  it("offers the prototype's value types and units, and No unit, after an empty choice", () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: VALUE_TYPE_AND_UNITS_TITLE }),
    ).toBeTruthy();
    expect(valueTypeSelect().getAttribute('name')).toBe('valueTypeId');
    expect(optionsOf(valueTypeSelect())).toEqual([
      ['', 'Select'],
      ...Object.values(VALUE_TYPES).map(({ id, name }) => [id, name]),
    ]);
    expect(unitSelect().getAttribute('name')).toBe('unitId');
    expect(optionsOf(unitSelect()).map(([, text]) => text)).toEqual([
      'Select',
      '%',
      'per 100',
      'per 1,000',
      'per 10,000',
      'per 100,000',
      'per 1,000,000',
      'minutes',
      'hours',
      'days',
      'weeks',
      'months',
      'years',
      '£',
      '£ per capita',
      'No unit',
      'Other',
    ]);
  });

  describe('with JavaScript', () => {
    it('asks nothing more until a value type and unit are chosen', () => {
      renderPage();

      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(referencePopulation())).toBe(false);
      expect(shown(unitOther())).toBe(false);
    });

    it('asks a directly standardised rate for its standard population', () => {
      renderPage();

      chooseValueType(VALUE_TYPES.directlyStandardisedRate.id);

      expect(shown(standardPopulationQuestion())).toBe(true);
      expect(
        within(standardPopulationQuestion())
          .getAllByRole('radio', { hidden: true })
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['esp-2013', 'other']);
      expect(screen.getByLabelText('2013 European Standard Population')).toBeTruthy();
      expect(shown(referencePopulation())).toBe(false);
    });

    it.each([
      VALUE_TYPES.indirectlyStandardisedProportion,
      VALUE_TYPES.indirectlyStandardisedRatio,
    ])('asks an $name for its reference population alone', ({ id }) => {
      renderPage();

      chooseValueType(id);

      expect(shown(referencePopulation())).toBe(true);
      expect(shown(standardPopulationQuestion())).toBe(false);
    });

    it('asks nothing more of any other value type', () => {
      renderPage();

      chooseValueType(VALUE_TYPES.crudeRate.id);

      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(referencePopulation())).toBe(false);
    });

    it('asks an other unit for its name', () => {
      renderPage();

      chooseUnit(UNITS.other.id);

      expect(shown(unitOther())).toBe(true);

      chooseUnit(UNITS.noUnit.id);

      expect(shown(unitOther())).toBe(false);
    });

    it('reveals the name of an other standard population under Other', () => {
      renderPage({ values: { ...empty, valueTypeId: VALUE_TYPES.directlyStandardisedRate.id } });

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
      valueType.value = VALUE_TYPES.indirectlyStandardisedRatio.id;
      unit.value = UNITS.other.id;

      render(page({}), { container, hydrate: true });

      expect(shown(referencePopulation())).toBe(true);
      expect(shown(standardPopulationQuestion())).toBe(false);
      expect(shown(unitOther())).toBe(true);
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
      expect(shown(unitOther())).toBe(true);
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
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        ...empty,
        valueTypeId: VALUE_TYPES.directlyStandardisedRate.id,
        standardPopulation: 'other',
        standardPopulationOther: 'England 2021',
        unitId: UNITS.other.id,
        unitOther: 'people',
      },
    });

    expect(valueTypeSelect().value).toBe(VALUE_TYPES.directlyStandardisedRate.id);
    expect((screen.getByLabelText('Other') as HTMLInputElement).checked).toBe(true);
    expect(standardPopulationOther().value).toBe('England 2021');
    expect(unitSelect().value).toBe(UNITS.other.id);
    expect(unitOther().value).toBe('people');
    expect(document.title).toBe(`${VALUE_TYPE_AND_UNITS_TITLE} - ${serviceName} - GOV.UK`);
  });

  it('summarises every refusal in the order the form asks, linking to each field', () => {
    renderPage({
      values: { ...empty, valueTypeId: VALUE_TYPES.directlyStandardisedRate.id },
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
    expect(document.title).toBe(`Error: ${VALUE_TYPE_AND_UNITS_TITLE} - ${serviceName} - GOV.UK`);
  });

  it('marks a refused reference population and links to it', () => {
    const { container } = renderPage({
      values: { ...empty, valueTypeId: VALUE_TYPES.indirectlyStandardisedRatio.id },
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

    expect(unitOther().className).toContain('govuk-input--width-20');
  });
});
