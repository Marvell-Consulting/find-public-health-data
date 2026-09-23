import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadPolarity, savePolarity } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const path = `/api/internal/indicators/${id}/polarity`;
const pageUrl = `https://internal.test/publish/indicators/${id}/polarity`;

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

function submit(body: Record<string, string>, put: ApiClient['put']) {
  return savePolarity({
    context: context({ put }),
    params: { id },
    request: new Request(pageUrl, { method: 'POST', body: new URLSearchParams(body) }),
  } as never);
}

describe('loadPolarity', () => {
  it("fills the form with the draft's polarity", async () => {
    const get = vi.fn().mockResolvedValue({ polarity: 'lower-is-better' });

    const outcome = await loadPolarity({
      context: context({ get }),
      params: { id },
      request: new Request(pageUrl),
    } as never);

    expect(get.mock.calls[0]?.[0]).toBe(path);
    expect(outcome).toEqual({ id, values: { polarity: 'lower-is-better' } });
  });

  it('chooses nothing while the draft has no polarity', async () => {
    const get = vi.fn().mockResolvedValue({ polarity: null });

    const outcome = await loadPolarity({
      context: context({ get }),
      params: { id },
      request: new Request(pageUrl),
    } as never);

    expect(outcome).toEqual({ id, values: { polarity: '' } });
  });
});

describe('savePolarity', () => {
  it('saves the chosen polarity and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: { polarity: 'higher-is-better' } });

    const outcome = await submit({ polarity: 'higher-is-better' }, put);

    expect(put.mock.calls[0]?.[0]).toBe(path);
    expect(put.mock.calls[0]?.[1]).toEqual({ polarity: 'higher-is-better' });
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });

  it('asks for a polarity when none is chosen, without calling the API', async () => {
    const put = vi.fn();

    const outcome = await submit({}, put);

    expect(outcome).toEqual({
      values: { polarity: '' },
      fieldErrors: { polarity: 'Select the polarity of the indicator' },
    });
    expect(put).not.toHaveBeenCalled();
  });
});
