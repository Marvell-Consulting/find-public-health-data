import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createIndicator, loadIndicatorName, saveIndicatorName } from './loader.ts';

const created = {
  id: '00000000-0000-7000-8000-000000000001',
  shortId: 90366,
  name: 'Life expectancy at birth',
  status: 'draft',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function submit(name: string, post: ApiClient['post']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { post } as unknown as ApiClient);

  const body = new URLSearchParams({ name });

  return createIndicator({
    context,
    params: {},
    request: new Request('https://internal.test/publish/indicators/new', {
      method: 'POST',
      body,
    }),
  } as never);
}

function accepts(data: unknown = created) {
  return vi.fn().mockResolvedValue({ ok: true, data });
}

describe('createIndicator', () => {
  it('creates the indicator and goes on to its overview page', async () => {
    const post = accepts();

    const outcome = await submit('Life expectancy at birth', post);

    expect(post.mock.calls[0]?.[0]).toBe('/api/internal/indicators');
    expect(post.mock.calls[0]?.[1]).toEqual({ name: 'Life expectancy at birth' });
    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).status).toBe(302);
    expect((outcome as Response).headers.get('location')).toBe(
      `/dashboard/indicators/${created.id}`,
    );
  });

  it('sends the name without its surrounding spaces', async () => {
    const post = accepts();

    await submit('  Life expectancy at birth  ', post);

    expect(post.mock.calls[0]?.[1]).toEqual({ name: 'Life expectancy at birth' });
  });

  it.each(['', '   '])('asks for a name of %o without calling the API', async (name) => {
    const post = vi.fn();

    const outcome = await submit(name, post);

    expect(outcome).toEqual({ name, fieldErrors: { name: 'Enter the name of the indicator' } });
    expect(post).not.toHaveBeenCalled();
  });

  it('shows what the API refused, keeping what was typed', async () => {
    const post = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: {
        error: 'validation_failed',
        fieldErrors: { name: 'Enter the name of the indicator' },
      },
    });

    const outcome = await submit('Rejected name', post);

    expect(outcome).toEqual({
      name: 'Rejected name',
      fieldErrors: { name: 'Enter the name of the indicator' },
    });
  });

  it('shows a name another indicator already holds on the form', async () => {
    const post = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      error: {
        error: 'slug_taken',
        fieldErrors: { name: 'An indicator with this name already exists' },
      },
    });

    const outcome = await submit('Life expectancy at birth', post);

    expect(outcome).toEqual({
      name: 'Life expectancy at birth',
      fieldErrors: { name: 'An indicator with this name already exists' },
    });
  });

  it('reports a refusal that names no field as a form with no field errors', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, error: { error: 'validation_failed' } });

    const outcome = await submit('Rejected name', post);

    expect(outcome).toEqual({ name: 'Rejected name', fieldErrors: {} });
  });
});

function load(id: string, get: ApiClient['get']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);

  return loadIndicatorName({
    context,
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/name`),
  } as never);
}

function rename(id: string, name: string, patch: ApiClient['patch']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { patch } as unknown as ApiClient);

  return saveIndicatorName({
    context,
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/name`, {
      method: 'POST',
      body: new URLSearchParams({ name }),
    }),
  } as never);
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

describe('loadIndicatorName', () => {
  it('fetches the draft the address names', async () => {
    const get = vi.fn().mockResolvedValue(created);

    const outcome = await load(created.id, get);

    expect(get.mock.calls[0]?.[0]).toBe(`/api/internal/indicators/${created.id}`);
    expect(outcome).toEqual({ indicator: created });
  });

  it('answers 404 for a published indicator, which has no name to edit', async () => {
    const get = vi.fn().mockResolvedValue({ ...created, status: 'published' });

    await expect(load(created.id, get)).rejects.toSatisfy(isNotFound);
  });

  it.each(['108', 'not-an-id'])('answers 404 to an id of %s without asking the API', async (id) => {
    const get = vi.fn();

    await expect(load(id, get)).rejects.toSatisfy(isNotFound);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('saveIndicatorName', () => {
  it('renames the draft and returns to the overview page', async () => {
    const patch = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { ...created, name: 'Renamed indicator' } });

    const outcome = await rename(created.id, '  Renamed indicator  ', patch);

    expect(patch.mock.calls[0]?.[0]).toBe(`/api/internal/indicators/${created.id}`);
    expect(patch.mock.calls[0]?.[1]).toEqual({ name: 'Renamed indicator' });
    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).headers.get('location')).toBe(
      `/dashboard/indicators/${created.id}`,
    );
  });

  it.each(['', '   '])('asks for a name of %o without calling the API', async (name) => {
    const patch = vi.fn();

    const outcome = await rename(created.id, name, patch);

    expect(outcome).toEqual({ name, fieldErrors: { name: 'Enter the name of the indicator' } });
    expect(patch).not.toHaveBeenCalled();
  });

  it('shows what the API refused, keeping what was typed', async () => {
    const patch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: {
        error: 'validation_failed',
        fieldErrors: { name: 'Enter the name of the indicator' },
      },
    });

    const outcome = await rename(created.id, 'Rejected name', patch);

    expect(outcome).toEqual({
      name: 'Rejected name',
      fieldErrors: { name: 'Enter the name of the indicator' },
    });
  });

  it('shows a name another indicator already holds on the form', async () => {
    const patch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      error: {
        error: 'slug_taken',
        fieldErrors: { name: 'An indicator with this name already exists' },
      },
    });

    const outcome = await rename(created.id, 'Life expectancy at birth', patch);

    expect(outcome).toEqual({
      name: 'Life expectancy at birth',
      fieldErrors: { name: 'An indicator with this name already exists' },
    });
  });

  // The API answers 404 when the draft went while the form was open; the client throws it.
  it('lets the not-found page through when the indicator no longer has a draft', async () => {
    const patch = vi.fn().mockRejectedValue(new Response('Not Found', { status: 404 }));

    await expect(rename(created.id, 'Too late', patch)).rejects.toSatisfy(isNotFound);
  });

  it.each(['108', 'not-an-id'])('answers 404 to an id of %s without asking the API', async (id) => {
    const patch = vi.fn();

    await expect(rename(id, 'Renamed indicator', patch)).rejects.toSatisfy(isNotFound);
    expect(patch).not.toHaveBeenCalled();
  });
});
