import { ApiConflictError } from '@fphd/web-server/api-client';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { flashedResponse, flashLeftBy, withFlashStorage } from './flash.testing.ts';
import { isLockedRefusal, unlessDraftLocked } from './locked-draft.ts';

const id = '00000000-0000-7000-8000-000000000001';
const request = new Request(`https://internal.test/publish/indicators/${id}/polarity`);

describe('isLockedRefusal', () => {
  it.each([
    ['a conflict naming the lock', new ApiConflictError('/p', { error: 'locked' }), true],
    ['a conflict for another reason', new ApiConflictError('/p', { error: 'changed' }), false],
    ['a conflict with no answer', new ApiConflictError('/p', null), false],
    ['a not-found response', new Response('Not Found', { status: 404 }), false],
  ])('tells %s', (_, error, expected) => {
    expect(isLockedRefusal(error)).toBe(expected);
  });
});

describe('unlessDraftLocked', () => {
  it('answers the read when the API serves it', async () => {
    const context = withFlashStorage(new RouterContextProvider());

    await expect(unlessDraftLocked(context, id, Promise.resolve('answers'))).resolves.toBe(
      'answers',
    );
  });

  it('sends the publisher to the overview, saying why, when the draft is locked', async () => {
    const context = withFlashStorage(new RouterContextProvider());
    const locked = Promise.reject(new ApiConflictError('/p', { error: 'locked' }));

    const response = await flashedResponse(context, request, () =>
      unlessDraftLocked(context, id, locked),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`/dashboard/indicators/${id}`);
    expect(await flashLeftBy(response)).toBe('draft-locked');
  });

  it('passes on any other failure', async () => {
    const context = withFlashStorage(new RouterContextProvider());
    const failure = new Response('Not Found', { status: 404 });

    await expect(unlessDraftLocked(context, id, Promise.reject(failure))).rejects.toBe(failure);
  });
});
