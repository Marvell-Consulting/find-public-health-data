// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { BATCH, DATA_TABLE } from './check-data.testing.ts';
import { DATA_TABLE_CHANGED } from './check-loader.ts';
import { CheckDataTablePage } from './check-page.tsx';

afterEach(cleanup);

const ID = '00000000-0000-7000-8000-000000000001';
const CHECK = `/publish/indicators/${ID}/data-table/check`;

function renderPage(props: Partial<Parameters<typeof CheckDataTablePage>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[CHECK]}>
      <CheckDataTablePage id={ID} dataTable={DATA_TABLE} totalPages={5237} {...props} />
    </MemoryRouter>,
  );
}

describe('CheckDataTablePage', () => {
  it('introduces the table with what the upload contains', () => {
    renderPage();

    expect(document.title).toBe(`Check the indicator data table - ${serviceName} - GOV.UK`);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check the indicator data table' }),
    ).toBeTruthy();
    expect(screen.getByText('Your upload contains 8 columns and 52,365 rows')).toBeTruthy();
  });

  it('shows the page of rows under the headings of the columns the file had', () => {
    renderPage();

    const table = within(screen.getByRole('region', { name: 'Data table' })).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Data values',
      'Lower CI 95.0 limit',
      'Upper CI 95.0 limit',
      'Period',
      'Area code',
      'Sex',
      'Age',
    ]);
    const [, row] = within(table).getAllByRole('row');
    expect([...(row?.querySelectorAll('th, td') ?? [])].map((cell) => cell.textContent)).toEqual([
      '83.8',
      '83.7',
      '83.9',
      '2019/20',
      'E92000001',
      'Female',
      'All ages',
    ]);
    expect(screen.getByText('Showing 1 to 10 of 52,365 rows')).toBeTruthy();
  });

  it('offers 10, 25 or 50 rows per page, with the current number chosen', () => {
    renderPage({ dataTable: { ...DATA_TABLE, rowsPerPage: 25 } });

    const select = screen.getByLabelText('Rows per page') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['10', '25', '50']);
    expect(select.value).toBe('25');
    expect(select.name).toBe('rowsPerPage');
    const form = select.closest('form');
    expect(form?.getAttribute('method')).toBe('get');
    expect(within(form as HTMLElement).getByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it('links to the pages around the current one, keeping the rows per page', () => {
    renderPage({ dataTable: { ...DATA_TABLE, page: 3, rowsPerPage: 25 }, totalPages: 2095 });

    const pages = within(screen.getByRole('navigation', { name: 'Data table pages' }));
    expect(pages.getByRole('link', { name: '3' }).getAttribute('aria-current')).toBe('page');
    expect(pages.getByRole('link', { name: '2095' }).getAttribute('href')).toBe(
      `${CHECK}?page=2095&rowsPerPage=25`,
    );
    expect(pages.getByRole('link', { name: '1' }).getAttribute('href')).toBe(
      `${CHECK}?rowsPerPage=25`,
    );
    expect(pages.getByRole('link', { name: /Next/ }).getAttribute('href')).toBe(
      `${CHECK}?page=4&rowsPerPage=25`,
    );
  });

  it('leaves out the page links when the rows fit on one page', () => {
    renderPage({ dataTable: { ...DATA_TABLE, rowCount: 1 }, totalPages: 1 });

    expect(screen.queryByRole('navigation', { name: 'Data table pages' })).toBeNull();
  });

  it('confirms the batch shown with Continue, or offers a different table', () => {
    renderPage();

    expect(screen.getByText('By continuing, you confirm the data table is correct.')).toBeTruthy();
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    const form = continueButton.closest('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe(CHECK);
    expect(new FormData(form).get('batchId')).toBe(BATCH);
    expect(
      screen.getByRole('button', { name: 'Choose a different data table' }).getAttribute('href'),
    ).toBe(`/publish/indicators/${ID}/data-table`);
  });

  it('says why when the table was replaced before Continue', () => {
    renderPage({ formError: DATA_TABLE_CHANGED });

    expect(document.title).toBe(`Error: Check the indicator data table - ${serviceName} - GOV.UK`);
    expect(within(screen.getByRole('alert')).getByText(DATA_TABLE_CHANGED)).toBeTruthy();
  });
});
