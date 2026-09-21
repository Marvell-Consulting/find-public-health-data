import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createIndicator } from './loader.ts';

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

    const outcome = await submit('Rejected', post);

    expect(outcome).toEqual({
      name: 'Rejected',
      fieldErrors: { name: 'Enter the name of the indicator' },
    });
  });

  it('reports a refusal that names no field as a form with no field errors', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, error: { error: 'validation_failed' } });

    const outcome = await submit('Rejected', post);

    expect(outcome).toEqual({ name: 'Rejected', fieldErrors: {} });
  });
});
