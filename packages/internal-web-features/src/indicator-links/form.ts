import {
  addLink,
  type IndicatorLink,
  indicatorLinkSchema,
  type LinksField,
  type LinksFormValues,
  type NewLinkField,
  type NewLinkFormValues,
} from '@fphd/internal-api-features/contract';

import { readFormValues } from '../form-values.ts';
import type { FormFailure, SectionAnswers } from '../indicator-section.ts';
import { type ListIntent, readListIntent, readListItems } from '../list-form.ts';

/** The page's answers, the links added so far, and the two fields that add another. */
export type LinksPageValues = LinksFormValues & NewLinkFormValues;

export type LinksPageField = LinksField | NewLinkField;

/** The page as the action re-renders it: after a refusal, or with a link added or removed. */
export type LinksPageState = FormFailure<LinksPageField, LinksPageValues>;

/** The name of the hidden field holding one part of the link at `index`. */
export function linkFieldName(index: number, part: keyof IndicatorLink): string {
  return `links[${index}].${part}`;
}

/**
 * The links the form carries. It only ever writes ones already accepted, so a link that
 * fails the rules was not sent by the page, and the request is refused whole.
 */
function readLinks(formData: FormData): IndicatorLink[] {
  return readListItems(formData, ['url', 'text'], linkFieldName).map((item) => {
    const link = indicatorLinkSchema.safeParse(item);

    if (!link.success) throw new Response('Bad Request', { status: 400 });

    return link.data;
  });
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readLinksForm(formData: FormData): {
  values: LinksPageValues;
  intent: ListIntent;
} {
  return {
    values: {
      ...readFormValues(formData, ['hasLinks', 'linkUrl', 'linkText']),
      links: readLinks(formData),
    },
    intent: readListIntent(formData),
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

/** The answers with a link typed but not yet added taken in, or that link's refusal. */
export function withTypedLinkTakenIn(
  values: LinksPageValues,
): SectionAnswers<LinksPageValues, LinksFormValues> | LinksPageState {
  const typed = values.linkUrl.trim() !== '' || values.linkText.trim() !== '';
  const added = values.hasLinks === 'yes' && typed ? addLink(values.links, values) : values;

  return 'fieldErrors' in added
    ? { values, fieldErrors: added.fieldErrors }
    : { values, answers: { hasLinks: values.hasLinks, links: added.links } };
}
