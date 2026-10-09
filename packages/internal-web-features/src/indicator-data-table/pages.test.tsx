// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { DataTableProblem } from './loader.ts';
import { DataTableProblemsPage, UploadDataTablePage } from './pages.tsx';

afterEach(cleanup);

const ID = '00000000-0000-7000-8000-000000000001';

function renderUpload(props: Parameters<typeof UploadDataTablePage>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={[`/publish/indicators/${ID}/data-table`]}>
      <UploadDataTablePage {...props} />
    </MemoryRouter>,
  );
}

function fileField() {
  return screen.getByLabelText('Upload indicator data table') as HTMLInputElement;
}

describe('UploadDataTablePage', () => {
  it('asks for the file with the heading as its label', () => {
    renderUpload();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Upload indicator data table' }),
    ).toBeTruthy();
    expect(fileField().type).toBe('file');
    expect(fileField().name).toBe('dataTable');
    expect(fileField().className).toBe('govuk-file-upload');
  });

  it('posts the file as a multipart form to its own page, with Continue', () => {
    renderUpload();

    const form = fileField().closest('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('enctype')).toBe('multipart/form-data');
    expect(form?.getAttribute('action')).toBeNull();
    expect(within(form as HTMLElement).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('marks the field and lists the error when the file was refused', () => {
    renderUpload({ fieldErrors: { dataTable: 'The selected file must be a CSV' } });

    expect(document.title).toBe(`Error: Upload indicator data table - ${serviceName} - GOV.UK`);
    expect(
      within(screen.getByRole('alert')).getByRole('link', {
        name: 'The selected file must be a CSV',
      }),
    ).toBeTruthy();
    expect(fileField().className).toContain('govuk-file-upload--error');
    expect(fileField().getAttribute('aria-describedby')).toBe('dataTable-error');
    expect(document.getElementById('dataTable-error')?.textContent).toContain(
      'The selected file must be a CSV',
    );
  });

  it('says nothing about progress until Continue is pressed, then says the upload is under way', () => {
    renderUpload();

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');

    fireEvent.submit(fileField().closest('form') as HTMLFormElement);

    expect(status.textContent).toBe(
      'Uploading and checking your data table. This can take a few minutes.',
    );
  });

  it('forgets the upload was under way when the page comes back from the browser cache', () => {
    renderUpload();
    fireEvent.submit(fileField().closest('form') as HTMLFormElement);

    const restored = new Event('pageshow');
    Object.assign(restored, { persisted: true });
    fireEvent(window, restored);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});

function renderProblems(problems: DataTableProblem[]) {
  return render(
    <MemoryRouter initialEntries={[`/publish/indicators/${ID}/data-table/problems`]}>
      <DataTableProblemsPage id={ID} problems={problems} />
    </MemoryRouter>,
  );
}

/** Each body row's cells as text. */
function rows() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tableRow) => [...tableRow.querySelectorAll('th, td')].map((cell) => cell.textContent));
}

describe('DataTableProblemsPage', () => {
  it('heads a table of problems, details and actions', () => {
    renderProblems([{ code: 'no_rows', items: [], count: 1 }]);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'There is a problem with the indicator data table you uploaded',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Problem',
      'Detail',
      'Actions',
    ]);
  });

  it('gives each missing column a row of its own', () => {
    renderProblems([{ code: 'missing_column', items: ['period_start', 'value'], count: 2 }]);

    expect(rows().map(([problem]) => problem)).toEqual([
      'period_start column missing',
      'value column missing',
    ]);
    expect(rows()[0]?.[1]).toBe(
      'Data table either:does not contain a period_start columnhas a period_start column with a non-standard heading',
    );
  });

  it('lists the unmatched codes with how many instances there are and what to check', () => {
    renderProblems([{ code: 'unmatched_area_codes', items: ['E92000000', 'E93000000'], count: 2 }]);

    expect(rows()).toEqual([
      [
        'Area codes could not be matched to reference data',
        'There are 2 instances of area codes in your data table that could not be matched to the reference data:E92000000E93000000',
        'You should either:check you uploaded the correct data tablecheck the reference data codes you intendedfix the data table and re-upload it',
      ],
    ]);
  });

  it('says the examples are some of them when there are more than it lists', () => {
    renderProblems([{ code: 'invalid_numbers', items: ['4', '9'], count: 1234 }]);

    expect(rows()[0]?.[1]).toBe(
      'There are 1,234 rows in your data table with a number that could not be read, such as one with a thousands separator, a unit or words, including:row 4row 9',
    );
  });

  it('speaks of one in the singular', () => {
    renderProblems([{ code: 'duplicate_rows', items: ['7'], count: 1 }]);

    expect(rows()[0]?.[1]).toBe(
      'There is 1 row in your data table with the same area code, period, sex, age and category as an earlier row:row 7',
    );
  });

  it('names a column heading that is blank', () => {
    renderProblems([{ code: 'unrecognised_columns', items: ['', 'period'], count: 2 }]);

    expect(rows()[0]?.[1]).toContain('(no heading)period');
  });

  it('tells a category column without its partner from rows without one', () => {
    renderProblems([{ code: 'unpaired_category', items: [], count: 1 }]);

    expect(rows()[0]?.[1]).toBe(
      'Your data table has a category_type column without a category column, or a category column without a category_type column.',
    );
  });

  it('offers the upload page again', () => {
    renderProblems([{ code: 'no_rows', items: [], count: 1 }]);

    const again = screen.getByRole('button', { name: 'Upload different or corrected data table' });
    expect(again.getAttribute('href')).toBe(`/publish/indicators/${ID}/data-table`);
  });

  it.each([
    'unreadable',
    'missing_column',
    'unrecognised_columns',
    'repeated_columns',
    'unpaired_category',
    'no_rows',
    'wrong_cell_count',
    'missing_cells',
    'unmatched_area_codes',
    'invalid_periods',
    'unmatched_sexes',
    'unmatched_ages',
    'unmatched_categories',
    'unmatched_value_notes',
    'invalid_numbers',
    'duplicate_rows',
  ] as const)('describes %s with a problem, a detail and actions', (code) => {
    renderProblems([{ code, items: ['5'], count: 1 }]);

    const [problem, detail, actions] = rows()[0] ?? [];
    expect(problem).not.toBe('');
    expect(detail).not.toBe('');
    expect(actions).toMatch(/^You should either:check you uploaded the correct data table/);
  });
});
