import { definitionAndRationaleSection as section } from '@fphd/internal-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { FORM_NOT_SAVED } from './form-refusal.ts';
import { loadIndicatorSection, readFormValues, saveIndicatorSection } from './indicator-section.ts';

// What every section's loader and action share, shown through the first section built on them.

const id = '00000000-0000-7000-8000-000000000001';
const answers = { definition: 'A definition', rationale: 'A rationale' };

function load(indicatorId: string, get: ApiClient['get']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);

  return loadIndicatorSection(
    {
      context,
      params: { id: indicatorId },
      request: new Request(`https://internal.test/publish/indicators/${indicatorId}/section`),
    } as never,
    section,
  );
}

function save(indicatorId: string, body: Record<string, string>, put: ApiClient['put']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { put } as unknown as ApiClient);

  return saveIndicatorSection(
    {
      context,
      params: { id: indicatorId },
      request: new Request(`https://internal.test/publish/indicators/${indicatorId}/section`, {
        method: 'POST',
        body: new URLSearchParams(body),
      }),
    } as never,
    section,
  );
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

describe('readFormValues', () => {
  it('reads each field as typed, and one the browser did not send as empty', () => {
    const formData = new FormData();
    formData.set('definition', '  As typed  ');

    expect(readFormValues(formData, ['definition', 'rationale'])).toEqual({
      definition: '  As typed  ',
      rationale: '',
    });
  });

  it('ignores anything posted that is not one of the fields', () => {
    const formData = new FormData();
    formData.set('definition', 'A definition');
    formData.set('extra', 'Not a field');

    expect(readFormValues(formData, ['definition'])).toEqual({ definition: 'A definition' });
  });

  it('reads a field from the control named for it', () => {
    const formData = new FormData();
    formData.set('date[day]', '14');

    expect(readFormValues(formData, ['day'], { day: 'date[day]' })).toEqual({ day: '14' });
  });
});

describe('loadIndicatorSection', () => {
  it('fills an unanswered field with nothing', async () => {
    const get = vi.fn().mockResolvedValue({ definition: 'A definition', rationale: null });

    await expect(load(id, get)).resolves.toEqual({
      id,
      values: { definition: 'A definition', rationale: '' },
    });
  });

  it('lets the not-found page through when the indicator has no draft', async () => {
    const get = vi.fn().mockRejectedValue(new Response('Not Found', { status: 404 }));

    await expect(load(id, get)).rejects.toSatisfy(isNotFound);
  });

  it.each(['108', 'not-an-id'])(
    'answers 404 to an id of %s without asking the API',
    async (bad) => {
      const get = vi.fn();

      await expect(load(bad, get)).rejects.toSatisfy(isNotFound);
      expect(get).not.toHaveBeenCalled();
    },
  );
});

describe('saveIndicatorSection', () => {
  it('sends every answer and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: answers });

    const outcome = await save(id, answers, put);

    expect(put.mock.calls[0]?.[1]).toEqual(answers);
    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).status).toBe(302);
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });

  it('saves nothing while any answer is missing, keeping what was typed', async () => {
    const put = vi.fn();

    const outcome = await save(id, { definition: 'Kept', rationale: '' }, put);

    expect(outcome).toEqual({
      values: { definition: 'Kept', rationale: '' },
      fieldErrors: { rationale: 'Enter the rationale for the indicator' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('shows what the API refused, keeping what was typed', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: { error: 'validation_failed', fieldErrors: { definition: 'Refused by the API' } },
    });

    const outcome = await save(id, answers, put);

    expect(outcome).toEqual({ values: answers, fieldErrors: { definition: 'Refused by the API' } });
  });

  it.each([
    ['an id', { error: 'invalid_id' }],
    ['no field', { error: 'validation_failed', fieldErrors: {} }],
  ])('reports a refusal naming %s as the form not saved', async (_case, error) => {
    const put = vi.fn().mockResolvedValue({ ok: false, status: 400, error });

    await expect(save(id, answers, put)).resolves.toEqual({
      values: answers,
      fieldErrors: {},
      formError: FORM_NOT_SAVED,
    });
  });

  // The API answers 404 when the draft went while the form was open; the client throws it.
  it('lets the not-found page through when the indicator no longer has a draft', async () => {
    const put = vi.fn().mockRejectedValue(new Response('Not Found', { status: 404 }));

    await expect(save(id, answers, put)).rejects.toSatisfy(isNotFound);
  });

  it.each(['108', 'not-an-id'])(
    'answers 404 to an id of %s without asking the API',
    async (bad) => {
      const put = vi.fn();

      await expect(save(bad, answers, put)).rejects.toSatisfy(isNotFound);
      expect(put).not.toHaveBeenCalled();
    },
  );
});
