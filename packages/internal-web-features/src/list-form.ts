/**
 * Which button sent a form that builds a list: Add, the Remove of one item, or Continue.
 * Continue has no name, so a form sent any other way continues.
 */
export type ListIntent = { to: 'add' } | { to: 'remove'; index: number } | { to: 'continue' };

/** The value of the Add button, which is named `intent`. */
export const ADD_INTENT = 'add';

/** The value of the button, named `intent`, that removes the item at `index`. */
export function removeIntent(index: number): string {
  return `remove-${index}`;
}

const REMOVE_INTENT = /^remove-(\d+)$/;

export function readListIntent(formData: FormData): ListIntent {
  const intent = formData.get('intent');

  if (intent === ADD_INTENT) return { to: 'add' };

  const removed = typeof intent === 'string' ? REMOVE_INTENT.exec(intent) : null;

  return removed === null ? { to: 'continue' } : { to: 'remove', index: Number(removed[1]) };
}
