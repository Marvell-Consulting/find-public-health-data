// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { ProviderSourcesPageValues } from './form.ts';
import { ProviderSourcesPage } from './page.tsx';

afterEach(cleanup);

const ons = {
  id: '01a0d858-9885-764e-8d53-6826aec67001',
  name: 'Office for National Statistics (ONS)',
  sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Annual mortality extract' }],
};
const estimated = { id: '01a0d858-9885-764e-8d53-6826aec67004', name: 'Estimated', sources: [] };
const providers = [ons, estimated];

const empty: ProviderSourcesPageValues = {
  sources: [],
  definition: '',
  providerId: '',
  sourceId: '',
};
const twoSources: ProviderSourcesPageValues = {
  ...empty,
  sources: [
    { providerId: ons.id, sourceId: ons.sources[0]?.id ?? null },
    { providerId: estimated.id, sourceId: null },
  ],
};

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof ProviderSourcesPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ProviderSourcesPage part="numerator" providers={providers} values={empty} {...props} />
    </MemoryRouter>,
  );
}

function providerSelect() {
  return screen.getByLabelText('Add a data provider for the numerator') as HTMLSelectElement;
}

function sourceSelect() {
  return screen.getByLabelText(/^Add the specific source/) as HTMLSelectElement;
}

function optionsOf(select: HTMLSelectElement) {
  return [...select.options].map((option) => option.text);
}

describe('ProviderSourcesPage', () => {
  it('asks about the part it is given, as the page heading and title', () => {
    renderPage({ part: 'denominator' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'What are the details of the denominator?' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add a data provider for the denominator')).toBeTruthy();
    expect(screen.getByLabelText('Enter the definition of the denominator')).toBeTruthy();
    expect(document.title).toBe(
      `What are the details of the denominator? - ${serviceName} - GOV.UK`,
    );
  });

  it('offers every provider', () => {
    renderPage();

    expect(optionsOf(providerSelect())).toEqual([
      'Select a data provider',
      'Office for National Statistics (ONS)',
      'Estimated',
    ]);
  });

  it("offers the chosen provider's sources once one is chosen, after no specific source", () => {
    renderPage();

    expect(sourceSelect().closest('[hidden]')).not.toBeNull();

    fireEvent.change(providerSelect(), { target: { value: ons.id } });

    expect(sourceSelect().closest('[hidden]')).toBeNull();
    expect(screen.getByLabelText(`Add the specific source from ${ons.name}`)).toBeTruthy();
    expect(optionsOf(sourceSelect())).toEqual([
      'Select a source',
      'No specific source',
      'Annual mortality extract',
    ]);
  });

  it('shows the sources of the provider chosen before the page was sent back', () => {
    renderPage({ values: { ...empty, providerId: estimated.id } });

    expect(sourceSelect().closest('[hidden]')).toBeNull();
    expect(optionsOf(sourceSelect())).toEqual(['Select a source', 'No specific source']);
  });

  it('lists the sources added, naming a provider alone where it has no specific source', () => {
    renderPage({ values: twoSources });

    const items = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual([
      'Office for National Statistics (ONS): Annual mortality extract',
      'Estimated',
    ]);
    expect(screen.getByRole('button', { name: 'Remove Estimated' }).getAttribute('value')).toBe(
      'remove-1',
    );
  });

  it('carries the added sources in hidden fields, an empty source being none specific', () => {
    const { container } = renderPage({ values: twoSources });

    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map((input) => [
      input.getAttribute('name'),
      input.getAttribute('value'),
    ]);

    expect(hidden).toEqual([
      ['sources[0].providerId', ons.id],
      ['sources[0].sourceId', ons.sources[0]?.id],
      ['sources[1].providerId', estimated.id],
      ['sources[1].sourceId', ''],
    ]);
  });

  it('links a refusal of the list to the provider select', () => {
    renderPage({
      fieldErrors: { sources: 'Add at least one data provider for the numerator' },
    });

    const summaryLink = within(screen.getByRole('alert')).getByRole('link');

    expect(summaryLink.getAttribute('href')).toBe(`#${providerSelect().id}`);
    expect(providerSelect().getAttribute('aria-describedby')).toContain('providerId-error');
  });

  it('shows a refusal that names no field in the summary', () => {
    renderPage({ formError: 'Your answers could not be saved. Try again.' });

    expect(within(screen.getByRole('alert')).getByText(/could not be saved/)).toBeTruthy();
  });
});
