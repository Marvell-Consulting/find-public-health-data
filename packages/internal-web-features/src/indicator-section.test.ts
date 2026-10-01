import { definitionAndRationaleSection as section } from '@fphd/internal-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { FORM_NOT_SAVED } from './form-refusal.ts';
import {
  type ControlNamesOf,
  loadIndicatorSection,
  saveIndicatorSection,
  saveIndicatorSectionValues,
} from './indicator-section.ts';

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

function save(
  indicatorId: string,
  body: Record<string, string>,
  put: ApiClient['put'],
  controlNames?: ControlNamesOf<'definition' | 'rationale'>,
) {
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
    controlNames,
  );
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

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

  it('reads each field from the control an answer in the submission chooses', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: answers });
    const body = { ...answers, which: 'second', second: 'A second rationale' };

    await save(id, body, put, (formData) =>
      formData.get('which') === 'second' ? { rationale: 'second' } : {},
    );

    expect(put.mock.calls[0]?.[1]).toEqual({ ...answers, rationale: 'A second rationale' });
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

  it('reports a refusal that names no field as the form not saved', async () => {
    const put = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, error: { error: 'invalid_id' } });

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
});

describe('saveIndicatorSectionValues', () => {
  function saveValues(
    values: { definition: string; rationale: string; typed: string },
    put: ApiClient['put'],
  ) {
    const context = new RouterContextProvider();
    context.set(apiContext, { put } as unknown as ApiClient);

    return saveIndicatorSectionValues(context, id, section, values, {
      answersSchema: {} as never,
      // Takes in what was typed as the rationale, refusing a typed "refuse".
      takeIn: (sent) =>
        sent.typed === 'refuse'
          ? { values: sent, fieldErrors: { typed: 'Refused before saving' } }
          : { values: { ...sent, typed: '' }, answers: { ...sent, rationale: sent.typed } },
    });
  }

  it('saves the answers the page takes in', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: answers });

    await saveValues({ definition: 'A definition', rationale: '', typed: 'Typed' }, put);

    expect(put.mock.calls[0]?.[1]).toEqual({ definition: 'A definition', rationale: 'Typed' });
  });

  it('re-renders the page as taken in when the answers are refused', async () => {
    const put = vi.fn();

    const outcome = await saveValues({ definition: '', rationale: '', typed: 'Typed' }, put);

    expect(outcome).toEqual({
      values: { definition: '', rationale: '', typed: '' },
      fieldErrors: { definition: 'Enter the definition of the indicator' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('saves nothing when the page refuses what it would take in', async () => {
    const put = vi.fn();
    const values = { definition: 'A definition', rationale: '', typed: 'refuse' };

    await expect(saveValues(values, put)).resolves.toEqual({
      values,
      fieldErrors: { typed: 'Refused before saving' },
    });
    expect(put).not.toHaveBeenCalled();
  });
});
