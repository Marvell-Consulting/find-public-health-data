/**
 * Which button sent a form that builds lists: an Add, the Remove of one item, or Continue.
 * Continue has no name, so a form sent any other way continues. A form with several lists
 * names the one each button changes; a form with one names none.
 */
export type ListIntent<List extends string = never> =
  | { to: 'add'; list?: List }
  | { to: 'remove'; index: number; list?: List }
  | { to: 'continue' };

/** The value of the Add button, which is named `intent`. */
export const ADD_INTENT = 'add';

/** The value of the Add button of `list`, on a form with several. */
export function addIntent(list?: string): string {
  return list === undefined ? ADD_INTENT : `${ADD_INTENT}-${list}`;
}

/** The value of the button, named `intent`, that removes the item at `index` of `list`. */
export function removeIntent(index: number, list?: string): string {
  return list === undefined ? `remove-${index}` : `remove-${list}-${index}`;
}

const INTENT = /^(add|remove)(?:-([A-Za-z]+))?(?:-(\d+))?$/;

/** The button that sent the form; one naming a list not in `lists` continues. */
export function readListIntent<List extends string = never>(
  formData: FormData,
  lists: readonly List[] = [],
): ListIntent<List> {
  const intent = formData.get('intent');
  const [, to, list, index] = (typeof intent === 'string' && INTENT.exec(intent)) || [];
  const named = list === undefined ? {} : { list: list as List };

  if (list !== undefined && !(lists as readonly string[]).includes(list)) return { to: 'continue' };
  if (to === 'add' && index === undefined) return { to: 'add', ...named };
  if (to === 'remove' && index !== undefined)
    return { to: 'remove', index: Number(index), ...named };

  return { to: 'continue' };
}
