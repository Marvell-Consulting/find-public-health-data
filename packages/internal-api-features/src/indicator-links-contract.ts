import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

export const LINK_URL_MAX_LENGTH = 2000;
export const LINK_TEXT_MAX_LENGTH = 200;
export const MAX_LINKS = 20;

// An absolute address on the web, which is all a link offered to the public may point to.
const url = z
  .string()
  .trim()
  .min(1, 'Enter a URL')
  .max(LINK_URL_MAX_LENGTH, 'URL must be 2,000 characters or fewer')
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      error: 'Enter a URL in the correct format, like https://www.gov.uk',
    }),
  );

const text = z
  .string()
  .trim()
  .min(1, 'Enter link text')
  .max(LINK_TEXT_MAX_LENGTH, 'Link text must be 200 characters or fewer');

export const indicatorLinkSchema = z.object({ url, text });

export type IndicatorLink = z.infer<typeof indicatorLinkSchema>;

// Scheme and host case, and an empty path, don't make a different address.
function sameAddress(url: string): string {
  return URL.canParse(url) ? new URL(url).href : url;
}

const linksSchema = z
  .array(indicatorLinkSchema)
  .max(MAX_LINKS, 'You cannot add more than 20 links')
  .refine(
    (links) => new Set(links.map((link) => sameAddress(link.url))).size === links.length,
    'Enter a URL that has not already been added',
  );

const fields = z.enum(['hasLinks', 'links']);

const schema = z
  .object({
    hasLinks: z.enum(['yes', 'no'], { error: 'Select whether there are any relevant links' }),
    links: linksSchema,
  })
  .superRefine(({ hasLinks, links }, ctx) => {
    if (hasLinks === 'yes' && links.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['links'], message: 'Add at least one link' });
    }
  });

export type LinksField = z.infer<typeof fields>;
export type Links = z.infer<typeof schema>;

/** The answers as the form holds them: the choice as text, and the links added so far. */
export interface LinksFormValues {
  hasLinks: string;
  links: IndicatorLink[];
}

export const linksSection: IndicatorSection<LinksField, Links, LinksFormValues> = {
  key: 'links',
  fields,
  schema,
};

/** The draft's answers: null until the question is answered, and no links until some are. */
export const linksAnswersSchema = z.object({
  hasLinks: z.enum(['yes', 'no']).nullable(),
  links: z.array(z.object({ url: z.string(), text: z.string() })),
});

export type LinksAnswers = z.infer<typeof linksAnswersSchema>;

export function linksFormValues({ hasLinks, links }: LinksAnswers): LinksFormValues {
  return { hasLinks: hasLinks ?? '', links };
}

export function areLinksComplete(answers: LinksAnswers): boolean {
  return schema.safeParse(linksFormValues(answers)).success;
}

/** The two fields that add a link to the list, as typed. */
export interface NewLinkFormValues {
  linkUrl: string;
  linkText: string;
}

export type NewLinkField = keyof NewLinkFormValues;

const newLinkSchema = z
  .object({ linkUrl: url, linkText: text })
  .transform(({ linkUrl, linkText }) => ({ url: linkUrl, text: linkText }));

/**
 * The list with the typed link added at its end, or why it was refused. A refusal of the
 * list itself, such as a repeated URL, is reported against the URL being added.
 */
export function addLink(
  links: readonly IndicatorLink[],
  newLink: NewLinkFormValues,
): { links: IndicatorLink[] } | { fieldErrors: Partial<Record<NewLinkField, string>> } {
  const link = newLinkSchema.safeParse(newLink);

  if (!link.success) {
    const fieldErrors: Partial<Record<NewLinkField, string>> = {};

    for (const issue of link.error.issues) {
      const field = issue.path[0] as NewLinkField;
      fieldErrors[field] ??= issue.message;
    }

    return { fieldErrors };
  }

  const added = linksSchema.safeParse([...links, link.data]);

  return added.success
    ? { links: added.data }
    : { fieldErrors: { linkUrl: added.error.issues[0]?.message ?? '' } };
}
