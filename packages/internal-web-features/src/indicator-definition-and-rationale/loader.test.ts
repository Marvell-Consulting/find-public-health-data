import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadDefinitionAndRationale, saveDefinitionAndRationale } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const path = `/api/internal/indicators/${id}/definition-and-rationale`;

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

function submit(body: Record<string, string>, put: ApiClient['put']) {
  return saveDefinitionAndRationale({
    context: context({ put }),
    params: { id },
    request: new Request(
      `https://internal.test/publish/indicators/${id}/definition-and-rationale`,
      {
        method: 'POST',
        body: new URLSearchParams(body),
      },
    ),
  } as never);
}

describe('loadDefinitionAndRationale', () => {
  it("fills the form with the draft's definition and rationale", async () => {
    const get = vi.fn().mockResolvedValue({ definition: 'A definition', rationale: 'A rationale' });

    const outcome = await loadDefinitionAndRationale({
      context: context({ get }),
      params: { id },
      request: new Request(
        `https://internal.test/publish/indicators/${id}/definition-and-rationale`,
      ),
    } as never);

    expect(get.mock.calls[0]?.[0]).toBe(path);
    expect(outcome).toEqual({
      id,
      values: { definition: 'A definition', rationale: 'A rationale' },
    });
  });
});

describe('saveDefinitionAndRationale', () => {
  it('saves both answers without their surrounding spaces and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: true,
      data: { definition: 'A definition', rationale: 'A rationale' },
    });

    const outcome = await submit(
      { definition: '  A definition ', rationale: '\nA rationale' },
      put,
    );

    expect(put.mock.calls[0]?.[0]).toBe(path);
    expect(put.mock.calls[0]?.[1]).toEqual({
      definition: 'A definition',
      rationale: 'A rationale',
    });
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });

  it('asks for both answers when neither is given, without calling the API', async () => {
    const put = vi.fn();

    const outcome = await submit({ definition: ' ', rationale: '' }, put);

    expect(outcome).toEqual({
      values: { definition: ' ', rationale: '' },
      fieldErrors: {
        definition: 'Enter the definition of the indicator',
        rationale: 'Enter the rationale for the indicator',
      },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('asks for the definition when only the rationale is given', async () => {
    const put = vi.fn();

    const outcome = await submit({ definition: '', rationale: 'A rationale' }, put);

    expect(outcome).toEqual({
      values: { definition: '', rationale: 'A rationale' },
      fieldErrors: { definition: 'Enter the definition of the indicator' },
    });
    expect(put).not.toHaveBeenCalled();
  });
});
