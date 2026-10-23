import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { FORM_NOT_SAVED } from '../form-refusal.ts';
import { BATCH, DATA_TABLE } from './check-data.testing.ts';
import { confirmDataTable, DATA_TABLE_CHANGED, loadDataTableCheck } from './check-loader.ts';

const ID = '00000000-0000-7000-8000-000000000001';
const CHECK = `https://internal.test/publish/indicators/${ID}/data-table/check`;

function contextWith(client: Partial<ApiClient>) {
  const context = new RouterContextProvider();
  context.set(apiContext, client as ApiClient);
  return context;
}

function load(get: ApiClient['get'], query = '', id = ID) {
  return loadDataTableCheck({
    context: contextWith({ get }),
    params: { id },
    request: new Request(`${CHECK}${query}`),
  } as never);
}

function confirm(put: ApiClient['put'], batchId: string | null = BATCH) {
  const form = new FormData();
  if (batchId !== null) form.set('batchId', batchId);

  return confirmDataTable({
    context: contextWith({ put }),
    params: { id: ID },
    request: new Request(CHECK, { method: 'POST', body: form }),
  } as never);
}

function locationOf(outcome: unknown) {
  expect(outcome).toBeInstanceOf(Response);
  return (outcome as Response).headers.get('location');
}

describe('loadDataTableCheck', () => {
  it('asks for the first page of 10 rows by default, and counts the pages', async () => {
    const get = vi.fn().mockResolvedValue({ dataTable: DATA_TABLE });

    expect(await load(get)).toEqual({ id: ID, dataTable: DATA_TABLE, totalPages: 5237 });
    expect(get.mock.calls[0]?.[0]).toBe(
      `/api/internal/indicators/${ID}/data-table?page=1&rowsPerPage=10`,
    );
  });

  it('asks for the page and rows per page in the address', async () => {
    const get = vi.fn().mockResolvedValue({
      dataTable: { ...DATA_TABLE, page: 4, rowsPerPage: 50 },
    });

    expect((await load(get, '?page=4&rowsPerPage=50')).totalPages).toBe(1048);
    expect(get.mock.calls[0]?.[0]).toBe(
      `/api/internal/indicators/${ID}/data-table?page=4&rowsPerPage=50`,
    );
  });

  it('sends the publisher to upload a file when none has loaded', async () => {
    const get = vi.fn().mockResolvedValue({ dataTable: null });

    const outcome = await load(get).catch((thrown: unknown) => thrown);

    expect(locationOf(outcome)).toBe(`/publish/indicators/${ID}/data-table`);
  });

  it('sends a page past the last to the last page, keeping the rows per page', async () => {
    const get = vi.fn().mockResolvedValue({
      dataTable: { ...DATA_TABLE, page: 40, rowsPerPage: 25, rowCount: 60, rows: [] },
    });

    const outcome = await load(get, '?page=40&rowsPerPage=25').catch((thrown: unknown) => thrown);

    expect(locationOf(outcome)).toBe(
      `/publish/indicators/${ID}/data-table/check?page=3&rowsPerPage=25`,
    );
  });

  it('sends a page past the end of a one-page table to the first page', async () => {
    const get = vi.fn().mockResolvedValue({
      dataTable: { ...DATA_TABLE, page: 2, rowCount: 10, rows: [] },
    });

    const outcome = await load(get, '?page=2').catch((thrown: unknown) => thrown);

    expect(locationOf(outcome)).toBe(`/publish/indicators/${ID}/data-table/check`);
  });

  it.each(['?page=0', '?rowsPerPage=20', '?page=1&page=2'])(
    'is not found for %s, without asking the API',
    async (query) => {
      const get = vi.fn();

      await expect(load(get, query)).rejects.toMatchObject({ status: 404 });
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('is not found for an id that is not one, without asking the API', async () => {
    const get = vi.fn();

    await expect(load(get, '', 'nope')).rejects.toMatchObject({ status: 404 });
    expect(get).not.toHaveBeenCalled();
  });
});

describe('confirmDataTable', () => {
  it('confirms the batch the page showed and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: { confirmedAt: '2026-10-12' } });

    const outcome = await confirm(put);

    expect(locationOf(outcome)).toBe(`/publish/indicators/${ID}/task-list`);
    expect(put.mock.calls[0]?.slice(0, 2)).toEqual([
      `/api/internal/indicators/${ID}/data-table/confirmation`,
      { batchId: BATCH },
    ]);
  });

  it('says the table was replaced when the draft points at another batch', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      error: { error: 'data_table_changed' },
    });

    expect(await confirm(put)).toEqual({ formError: DATA_TABLE_CHANGED });
  });

  it('says it was not saved when the API refuses the form', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: { error: 'validation_failed' },
    });

    expect(await confirm(put, null)).toEqual({ formError: FORM_NOT_SAVED });
    expect(put.mock.calls[0]?.[1]).toEqual({ batchId: '' });
  });
});
