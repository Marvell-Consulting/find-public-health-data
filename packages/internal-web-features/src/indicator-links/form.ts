import {
  addLink,
  type IndicatorLink,
  indicatorLinkSchema,
  type LinksField,
  type LinksFormValues,
  type NewLinkField,
  type NewLinkFormValues,
} from '@fphd/internal-api-features/contract';

import type { FormFailure } from '../indicator-section.ts';

/** The page's answers, the links added so far, and the two fields that add another. */
export type LinksPageValues = LinksFormValues & NewLinkFormValues;

export type LinksPageField = LinksField | NewLinkField;

/** The page as the action re-renders it: after a refusal, or with a link added or removed. */
export type LinksPageState = FormFailure<LinksPageField, LinksPageValues>;

/** Which button sent the form. Continue has no name, so a form sent any other way continues. */
export type LinksIntent = { to: 'add' } | { to: 'remove'; index: number } | { to: 'continue' };

/** The name of the hidden field holding one part of the link at `index`. */
export function linkFieldName(index: number, part: keyof IndicatorLink): string {
  return `links[${index}].${part}`;
}

/** The value of the button that removes the link at `index`. */
export function removeLinkIntent(index: number): string {
  return `remove-${index}`;
}

const REMOVE_INTENT = /^remove-(\d+)$/;

function readIntent(formData: FormData): LinksIntent {
  const intent = formData.get('intent');

  if (intent === 'add') return { to: 'add' };

  const removed = typeof intent === 'string' ? REMOVE_INTENT.exec(intent) : null;

  return removed === null ? { to: 'continue' } : { to: 'remove', index: Number(removed[1]) };
}

/**
 * The links the form carries. It only ever writes ones already accepted, so a link that
 * fails the rules was not sent by the page, and the request is refused whole.
 */
function readLinks(formData: FormData): IndicatorLink[] {
  const links: IndicatorLink[] = [];

  for (let index = 0; formData.has(linkFieldName(index, 'url')); index++) {
    const link = indicatorLinkSchema.safeParse({
      url: formData.get(linkFieldName(index, 'url')),
      text: formData.get(linkFieldName(index, 'text')),
    });

    if (!link.success) throw new Response('Bad Request', { status: 400 });

    links.push(link.data);
  }

  return links;
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readLinksForm(formData: FormData): {
  values: LinksPageValues;
  intent: LinksIntent;
} {
  const text = (name: 'hasLinks' | NewLinkField) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };

  return {
    values: {
      hasLinks: text('hasLinks'),
      links: readLinks(formData),
      linkUrl: text('linkUrl'),
      linkText: text('linkText'),
    },
    intent: readIntent(formData),
  };
}

/**
 * The page with the typed link added and its fields cleared, or refused. Adding a link
 * answers "Yes", which a form without JavaScript may not have chosen.
 */
export function withLinkAdded(values: LinksPageValues): LinksPageState {
  const added = addLink(values.links, values);
  const answered = { ...values, hasLinks: 'yes' };

  return 'fieldErrors' in added
    ? { values: answered, fieldErrors: added.fieldErrors }
    : { values: { ...answered, links: added.links, linkUrl: '', linkText: '' }, fieldErrors: {} };
}

/** The page without the link at `index`, keeping anything typed in the fields. */
export function withLinkRemoved(values: LinksPageValues, index: number): LinksPageState {
  return {
    values: { ...values, links: values.links.filter((_, at) => at !== index) },
    fieldErrors: {},
  };
}
