import { z } from '@fphd/config/zod';

import { type IndicatorSection, toFieldErrors, yesNoSchema } from './indicator-section-contract.ts';
import { shortText } from './text-contract.ts';

export const LINK_URL_MAX_LENGTH = 2000;
export const MAX_LINKS = 20;

// An absolute address on the web, which is all a link offered to the public may point to.
const url = shortText('URL', LINK_URL_MAX_LENGTH)
  .min(1, 'Enter a URL')
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      error: 'Enter a URL in the correct format, like https://www.gov.uk',
    }),
  );

const text = shortText('Link text').min(1, 'Enter link text');

export const indicatorLinkSchema = z.object({ url, text });

export type IndicatorLink = z.infer<typeof indicatorLinkSchema>;

// Scheme and host case, and an empty path, don't make a different address.
function sameAddress(url: string): string {
  return URL.canParse(url) ? new URL(url).href : url;
}

const linksSchema = z
  .array(indicatorLinkSchema)
  .max(MAX_LINKS, `You cannot add more than ${MAX_LINKS} links`)
  .refine(
    (links) => new Set(links.map((link) => sameAddress(link.url))).size === links.length,
    'Enter a URL that has not already been added',
  );

const fields = z.enum(['hasLinks', 'links']);

const schema = z
  .object({
    hasLinks: yesNoSchema('Select whether there are any relevant links'),
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

/** The draft's answers: null until the question is answered, and no links until some are. */
export const linksAnswersSchema = z.object({
  hasLinks: z.enum(['yes', 'no']).nullable(),
  links: z.array(z.object({ url: z.string(), text: z.string() })),
});

export type LinksAnswers = z.infer<typeof linksAnswersSchema>;

export const linksSection: IndicatorSection<
  LinksField,
  Links,
  LinksFormValues,
  LinksField,
  LinksAnswers
> = {
  key: 'links',
  fields,
  schema,
  formValues: ({ hasLinks, links }) => ({ hasLinks: hasLinks ?? '', links }),
};

/** The two fields that add a link to the list, as typed. */
export interface NewLinkFormValues {
  linkUrl: string;
  linkText: string;
}

const newLinkFields = z.enum(['linkUrl', 'linkText']);

export type NewLinkField = z.infer<typeof newLinkFields>;

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

  if (!link.success) return { fieldErrors: toFieldErrors(link.error, newLinkFields) };

  const added = linksSchema.safeParse([...links, link.data]);

  return added.success
    ? { links: added.data }
    : { fieldErrors: { linkUrl: added.error.issues[0]?.message ?? 'The link could not be added' } };
}
