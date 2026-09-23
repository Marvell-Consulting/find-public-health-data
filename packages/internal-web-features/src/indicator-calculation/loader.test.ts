import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadCalculation, saveCalculation } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const path = `/api/internal/indicators/${id}/calculation`;

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

function submit(body: Record<string, string>, put: ApiClient['put']) {
  return saveCalculation({
    context: context({ put }),
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/calculation`, {
      method: 'POST',
      body: new URLSearchParams(body),
    }),
  } as never);
}

describe('loadCalculation', () => {
  it("fills the form with the draft's answers, leaving an unanswered choice unchosen", async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ methodology: 'A method', calculatedBy: null, calculatedByOther: null });

    const outcome = await loadCalculation({
      context: context({ get }),
      params: { id },
      request: new Request(`https://internal.test/publish/indicators/${id}/calculation`),
    } as never);

    expect(get.mock.calls[0]?.[0]).toBe(path);
    expect(outcome).toEqual({
      id,
      values: { methodology: 'A method', calculatedBy: '', calculatedByOther: '' },
    });
  });
});

describe('saveCalculation', () => {
  it('saves every answer without its surrounding spaces and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: true,
      data: { methodology: 'A method', calculatedBy: 'other', calculatedByOther: 'ONS' },
    });

    const outcome = await submit(
      { methodology: ' A method\n', calculatedBy: 'other', calculatedByOther: '  ONS' },
      put,
    );

    expect(put.mock.calls[0]?.[0]).toBe(path);
    expect(put.mock.calls[0]?.[1]).toEqual({
      methodology: 'A method',
      calculatedBy: 'other',
      calculatedByOther: 'ONS',
    });
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });

  it('asks for the methodology and who calculated it when no radio is chosen', async () => {
    const put = vi.fn();

    const outcome = await submit({ methodology: ' ', calculatedByOther: '' }, put);

    expect(outcome).toEqual({
      values: { methodology: ' ', calculatedBy: '', calculatedByOther: '' },
      fieldErrors: {
        methodology: 'Enter the methodology',
        calculatedBy: 'Select who calculated the indicator',
      },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('asks for the other organisations when "Other" is chosen without them', async () => {
    const put = vi.fn();

    const outcome = await submit(
      { methodology: 'A method', calculatedBy: 'other', calculatedByOther: '' },
      put,
    );

    expect(outcome).toEqual({
      values: { methodology: 'A method', calculatedBy: 'other', calculatedByOther: '' },
      fieldErrors: {
        calculatedByOther: 'Enter details of the other organisation or organisations',
      },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('does not ask for the other organisations when OHID or DHSC is chosen', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: true,
      data: { methodology: 'A method', calculatedBy: 'dhsc', calculatedByOther: null },
    });

    const outcome = await submit(
      { methodology: 'A method', calculatedBy: 'dhsc', calculatedByOther: '' },
      put,
    );

    expect(outcome).toBeInstanceOf(Response);
  });
});
