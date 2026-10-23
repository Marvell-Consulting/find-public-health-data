import { setFlash } from '@fphd/web-server/flash';

type FlashContext = Parameters<typeof setFlash>[0];

/** A message for the overview to show: a success, or something the publisher needs to know. */
export interface OverviewNotification {
  type: 'success' | 'important';
  text: string;
}

/** Resolved on the server so a cookie value is only ever a key into copy written here. */
const NOTIFICATIONS = {
  'indicator-submitted': {
    type: 'success',
    text: 'Indicator successfully submitted for approval.',
  },
  'submission-withdrawn': {
    type: 'success',
    text: 'Submission withdrawn. You can now edit the indicator.',
  },
  'withdraw-refused': {
    type: 'important',
    text: 'This submission can no longer be withdrawn.',
  },
  'draft-locked': {
    type: 'important',
    text: 'This indicator has been submitted for approval and cannot be edited.',
  },
} as const satisfies Record<string, OverviewNotification>;

export type OverviewFlash = keyof typeof NOTIFICATIONS;

/** Leaves the overview a message to show once the publisher is redirected to it. */
export function setOverviewFlash(context: FlashContext, flash: OverviewFlash): void {
  setFlash(context, flash);
}

/** The message a flash asks for, or none for a flash the overview does not know. */
export function overviewNotification(flash: string | undefined): OverviewNotification | undefined {
  // `in` would also admit inherited keys like 'constructor'.
  return flash !== undefined && Object.hasOwn(NOTIFICATIONS, flash)
    ? NOTIFICATIONS[flash as OverviewFlash]
    : undefined;
}
