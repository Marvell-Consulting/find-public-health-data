import { denominatorSection, numeratorSection } from '@fphd/internal-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { FORM_NOT_SAVED } from '../form-refusal.ts';
import { sourceFieldName } from './form.ts';
import { loadProviderSources, submitProviderSources } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const sectionPath = `/api/internal/indicators/${id}/numerator`;
const providersPath = '/api/internal/data-providers';

const ons = {
  id: '01a0d858-9885-764e-8d53-6826aec67001',
  name: 'Office for National Statistics (ONS)',
  sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Annual mortality extract' }],
};
const estimated = { id: '01a0d858-9885-764e-8d53-6826aec67004', name: 'Estimated', sources: [] };
const providers = [ons, estimated];

const mortality = { providerId: ons.id, sourceId: ons.sources[0]?.id ?? null };
const estimatedAlone = { providerId: estimated.id, sourceId: null };

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

/** Answers the providers list, and the section's answers from `answers`. */
function getting(answers: unknown) {
  return vi
    .fn()
    .mockImplementation(async (path: string) => (path === providersPath ? providers : answers));
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

function isBadRequest(error: unknown) {
  return error instanceof Response && error.status === 400;
}

function load(indicatorId: string, get: ApiClient['get'], section = numeratorSection) {
  return loadProviderSources(
    {
      context: context({ get }),
      params: { id: indicatorId },
      request: new Request(`https://internal.test/publish/indicators/${indicatorId}/numerator`),
    } as never,
    section,
  );
}

function submit(
  fields: Record<string, string>,
  sources: { providerId: string; sourceId: string | null }[],
  put: ApiClient['put'],
) {
  const body = new URLSearchParams(fields);
  sources.forEach(({ providerId, sourceId }, index) => {
    body.set(sourceFieldName(index, 'providerId'), providerId);
    body.set(sourceFieldName(index, 'sourceId'), sourceId ?? '');
  });

  return submitProviderSources(
    {
      context: context({ get: getting(undefined), put }),
      params: { id },
      request: new Request(`https://internal.test/publish/indicators/${id}/numerator`, {
        method: 'POST',
        body,
      }),
    } as never,
    numeratorSection,
  );
}

function isRedirectToTaskList(outcome: unknown) {
  return (
    outcome instanceof Response &&
    outcome.status === 302 &&
    outcome.headers.get('location') === `/publish/indicators/${id}/task-list`
  );
}

const nothingChosen = { providerId: '', sourceId: '' };

describe('loadProviderSources', () => {
  it("fills the form with the draft's answers, nothing chosen, and the providers offered", async () => {
    const get = getting({ sources: [mortality], definition: 'Deaths' });

    await expect(load(id, get)).resolves.toEqual({
      id,
      providers,
      values: { sources: [mortality], definition: 'Deaths', ...nothingChosen },
    });
    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([providersPath, sectionPath]);
  });

  it("reads the denominator's answers from its own endpoint", async () => {
    const get = getting({ sources: [], definition: null });

    await expect(load(id, get, denominatorSection)).resolves.toMatchObject({
      values: { sources: [], definition: '' },
    });
    expect(get.mock.calls.map(([path]) => path)).toContain(
      `/api/internal/indicators/${id}/denominator`,
    );
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

describe('submitProviderSources', () => {
  it("shows the chosen provider's sources without saving anything", async () => {
    const put = vi.fn();

    const outcome = await submit(
      { intent: 'show-sources', providerId: ons.id, sourceId: '', definition: 'Deaths' },
      [],
      put,
    );

    expect(outcome).toEqual({
      values: { sources: [], definition: 'Deaths', providerId: ons.id, sourceId: '' },
      fieldErrors: {},
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('asks for a provider when Show sources is selected with none chosen', async () => {
    const outcome = await submit({ intent: 'show-sources', ...nothingChosen }, [], vi.fn());

    expect(outcome).toMatchObject({ fieldErrors: { providerId: 'Select a data provider' } });
  });

  it('adds the chosen provider and source without saving anything, clearing the selects', async () => {
    const put = vi.fn();

    const outcome = await submit(
      { intent: 'add', providerId: estimated.id, sourceId: 'none', definition: '' },
      [mortality],
      put,
    );

    expect(outcome).toEqual({
      values: { sources: [mortality, estimatedAlone], definition: '', ...nothingChosen },
      fieldErrors: {},
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('refuses to add a provider with no source chosen, keeping the page as sent', async () => {
    const fields = { intent: 'add', providerId: ons.id, sourceId: '', definition: '' };

    const outcome = await submit(fields, [], vi.fn());

    expect(outcome).toEqual({
      values: { sources: [], definition: '', providerId: ons.id, sourceId: '' },
      fieldErrors: { sourceId: 'Select a source, or No specific source' },
    });
  });

  it('removes a source without saving anything', async () => {
    const put = vi.fn();

    const outcome = await submit({ intent: 'remove-0' }, [mortality, estimatedAlone], put);

    expect(outcome).toMatchObject({ values: { sources: [estimatedAlone] }, fieldErrors: {} });
    expect(put).not.toHaveBeenCalled();
  });

  it('saves the sources and definition on Continue and returns to the task list', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: {} });

    const outcome = await submit(
      { definition: ' Deaths ', ...nothingChosen },
      [mortality, estimatedAlone],
      put,
    );

    expect(put.mock.calls[0]?.[0]).toBe(sectionPath);
    expect(put.mock.calls[0]?.[1]).toEqual({
      sources: [mortality, estimatedAlone],
      definition: 'Deaths',
    });
    expect(outcome).toSatisfy(isRedirectToTaskList);
  });

  it('saves a provider and source chosen but not added along with the others', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true, data: {} });

    await submit(
      { definition: 'Deaths', providerId: estimated.id, sourceId: 'none' },
      [mortality],
      put,
    );

    expect(put.mock.calls[0]?.[1]).toEqual({
      sources: [mortality, estimatedAlone],
      definition: 'Deaths',
    });
  });

  it('saves nothing while the answers are refused', async () => {
    const put = vi.fn();

    const outcome = await submit({ definition: '', ...nothingChosen }, [], put);

    expect(outcome).toEqual({
      values: { sources: [], definition: '', ...nothingChosen },
      fieldErrors: {
        sources: 'Add at least one data provider for the numerator',
        definition: 'Enter the definition of the numerator',
      },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the rest of the refusals with a chosen source that cannot be added', async () => {
    const put = vi.fn();
    const fields = { definition: ' ', providerId: ons.id, sourceId: '' };

    const outcome = await submit(fields, [mortality], put);

    expect(outcome).toEqual({
      values: { sources: [mortality], ...fields },
      fieldErrors: {
        sourceId: 'Select a source, or No specific source',
        definition: 'Enter the definition of the numerator',
      },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('leaves out asking for a provider when the chosen one cannot be added', async () => {
    const fields = { definition: 'Deaths', providerId: ons.id, sourceId: '' };

    const outcome = await submit(fields, [], vi.fn());

    expect(outcome).toEqual({
      values: { sources: [], ...fields },
      fieldErrors: { sourceId: 'Select a source, or No specific source' },
    });
  });

  it('explains a refusal from the API that names no field', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: { error: 'invalid_id' },
    });

    await expect(
      submit({ definition: 'Deaths', ...nothingChosen }, [mortality], put),
    ).resolves.toEqual({
      values: { sources: [mortality], definition: 'Deaths', ...nothingChosen },
      fieldErrors: {},
      formError: FORM_NOT_SAVED,
    });
  });

  it.each([
    ['a malformed source', [{ providerId: 'not-an-id', sourceId: null }]],
    ['a source the providers do not offer', [{ providerId: estimated.id, sourceId: ons.id }]],
  ])('refuses %s, which the page never sends', async (_, sources) => {
    await expect(submit({ intent: 'add' }, sources, vi.fn())).rejects.toSatisfy(isBadRequest);
  });
});
