import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadConfidenceIntervals, saveConfidenceIntervals } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const sectionPath = `/api/internal/indicators/${id}/confidence-intervals`;
const methodId = '019fa38f-073f-764e-9ac6-1c4d03b1cb92';

const methods = [
  { id: methodId, name: "Byar's method", description: 'A description.', kind: 'standard' },
];

const unanswered = {
  ciMethodId: '',
  ciMethodModified: '',
  ciMethodModifications: '',
  ciMethodOtherDetail: '',
};

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

function load(indicatorId: string, get: ApiClient['get']) {
  return loadConfidenceIntervals({
    context: context({ get }),
    params: { id: indicatorId },
    request: new Request(
      `https://internal.test/publish/indicators/${indicatorId}/confidence-intervals`,
    ),
  } as never);
}

function submit(body: Record<string, string>, put: ApiClient['put']) {
  return saveConfidenceIntervals({
    context: context({ put }),
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/confidence-intervals`, {
      method: 'POST',
      body: new URLSearchParams(body),
    }),
  } as never);
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

describe('loadConfidenceIntervals', () => {
  it("fills the form with the draft's answers and offers every method", async () => {
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path === sectionPath
          ? {
              ciMethodId: methodId,
              ciMethodModified: 'no',
              ciMethodModifications: null,
              ciMethodOtherDetail: null,
            }
          : methods,
      ),
    );

    const outcome = await load(id, get as unknown as ApiClient['get']);

    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
      '/api/internal/ci-methods',
      sectionPath,
    ]);
    expect(outcome).toEqual({
      id,
      values: { ...unanswered, ciMethodId: methodId, ciMethodModified: 'no' },
      methods,
    });
  });

  it.each(['108', 'not-an-id'])(
    'answers 404 to an id of %s without asking the API for anything',
    async (bad) => {
      const get = vi.fn();

      await expect(load(bad, get)).rejects.toSatisfy(isNotFound);
      expect(get).not.toHaveBeenCalled();
    },
  );
});

describe('saveConfidenceIntervals', () => {
  it('sends every answer and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: {} });

    const outcome = await submit(
      {
        ...unanswered,
        ciMethodId: methodId,
        ciMethodModified: 'yes',
        ciMethodModifications: ' Adjusted ',
      },
      put,
    );

    expect(put.mock.calls[0]?.[0]).toBe(sectionPath);
    expect(put.mock.calls[0]?.[1]).toEqual({
      ...unanswered,
      ciMethodId: methodId,
      ciMethodModified: 'yes',
      ciMethodModifications: 'Adjusted',
    });
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });

  it('asks for a method when none is chosen, without calling the API', async () => {
    const put = vi.fn();

    const outcome = await submit(unanswered, put);

    expect(outcome).toEqual({
      values: unanswered,
      fieldErrors: { ciMethodId: 'Select the confidence interval method used' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("shows what the API refused of the chosen method's answers, keeping what was typed", async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: {
        error: 'validation_failed',
        fieldErrors: { ciMethodModified: 'Select whether any modifications were used' },
      },
    });
    const body = { ...unanswered, ciMethodId: methodId, ciMethodOtherDetail: 'Kept' };

    const outcome = await submit(body, put);

    expect(outcome).toEqual({
      values: body,
      fieldErrors: { ciMethodModified: 'Select whether any modifications were used' },
    });
  });
});
