import { ApiConflictError } from '@fphd/web-server/api-client';
import { redirect } from 'react-router';

import { setOverviewFlash } from './indicator-overview/notifications.ts';
import { indicatorOverviewPath } from './indicator-overview/paths.ts';

type FlashContext = Parameters<typeof setOverviewFlash>[0];

/** Sends the publisher to the overview, which says the draft is locked for review. */
export function lockedDraftRedirect(context: FlashContext, id: string): Response {
  setOverviewFlash(context, 'draft-locked');
  return redirect(indicatorOverviewPath(id));
}

/** True when the API refused a read because the draft is locked for review. */
export function isLockedRefusal(error: unknown): boolean {
  return (
    error instanceof ApiConflictError &&
    typeof error.body === 'object' &&
    error.body !== null &&
    'error' in error.body &&
    error.body.error === 'locked'
  );
}

/** A read of the draft, or, when the draft is locked for review, the redirect to the overview. */
export async function unlessDraftLocked<T>(
  context: FlashContext,
  id: string,
  read: Promise<T>,
): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (isLockedRefusal(error)) throw lockedDraftRedirect(context, id);
    throw error;
  }
}
