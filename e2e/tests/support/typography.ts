import { expect, type Page } from '@playwright/test';

/**
 * Every question matching one of `texts`, as `[text, "<size> <weight>"]`. A text appearing more
 * than once on a page, as "Provide details" does, yields one entry per element rather than one
 * for the first, so a change to any of them is visible.
 */
export function questionStyles(page: Page, texts: string[]): Promise<[string, string][]> {
  return page.evaluate(
    (list) =>
      list.flatMap((text) => {
        const matches = [
          ...document.querySelectorAll('main label.govuk-label, main legend'),
        ].filter((el) => el.textContent?.trim().replace(/\s+/g, ' ') === text);
        return matches.map((question): [string, string] => {
          // The size sits on the heading when the question is one, and on the label when it is not.
          const style = getComputedStyle(
            question.querySelector('h1, h2, h3, h4, h5, h6') ?? question,
          );
          return [text, `${style.fontSize} ${style.fontWeight}`];
        });
      }),
    texts,
  );
}

/** A question the page asks, sized to match the others it asks. */
export const QUESTION = '24px 700';

/** The one question a page asks, which is its heading too, so it takes the page heading's size. */
export const PAGE_QUESTION = '48px 700';

/** A question asked inside another's answer, smaller than the one it sits under. */
export const SUB_QUESTION = '19px 700';

/** The details an answer asks for, which follow it rather than asking anything of their own. */
export const ANSWER_DETAIL = '19px 400';

/** Fails unless every one of `texts` is on the page, each rendered at `expected`. */
export async function expectQuestionStyles(page: Page, texts: string[], expected: string) {
  const found = await questionStyles(page, texts);
  const unique = (list: string[]) => [...new Set(list)].sort();

  expect(unique(found.map(([text]) => text))).toEqual(unique(texts));
  expect(found.map(([, style]) => style)).toEqual(found.map(() => expected));
}
