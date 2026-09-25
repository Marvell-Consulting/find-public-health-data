import { describe, expect, it } from 'vitest';

import {
  addLink,
  areLinksComplete,
  type IndicatorLink,
  MAX_LINKS,
  linksSection as section,
} from './indicator-links-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const commentary = { url: 'https://www.gov.uk/statistics', text: 'Statistical commentary' };
const fingertips = { url: 'https://fingertips.phe.org.uk/', text: 'Fingertips' };

/** As many distinct links as the list may hold. */
const fullList: IndicatorLink[] = Array.from({ length: MAX_LINKS }, (_, index) => ({
  url: `https://www.gov.uk/${index}`,
  text: `Link ${index}`,
}));

describe('linksSection', () => {
  it('takes the links without their surrounding spaces, in the order given', () => {
    expect(
      section.schema.parse({
        hasLinks: 'yes',
        links: [
          { url: ' https://www.gov.uk/statistics\n', text: '\tStatistical commentary ' },
          fingertips,
        ],
      }),
    ).toEqual({ hasLinks: 'yes', links: [commentary, fingertips] });
  });

  it('asks for no links beside "No"', () => {
    expect(sectionFieldErrors(section, { hasLinks: 'no', links: [] })).toBeUndefined();
  });

  it.each([
    [{ hasLinks: '', links: [] }, { hasLinks: 'Select whether there are any relevant links' }],
    [{ hasLinks: 'maybe', links: [] }, { hasLinks: 'Select whether there are any relevant links' }],
    [{ hasLinks: 'yes', links: [] }, { links: 'Add at least one link' }],
    [
      { hasLinks: 'yes', links: [commentary, commentary] },
      { links: 'Enter a URL that has not already been added' },
    ],
    [
      { hasLinks: 'yes', links: [...fullList, commentary] },
      { links: 'You cannot add more than 20 links' },
    ],
    [
      { hasLinks: 'yes', links: [{ url: 'javascript:alert(1)', text: 'A link' }] },
      { links: 'Enter a URL in the correct format, like https://www.gov.uk' },
    ],
  ])('refuses %o', (body, fieldErrors) => {
    expect(sectionFieldErrors(section, body)).toEqual(fieldErrors);
  });
});

describe('areLinksComplete', () => {
  it.each([
    [{ hasLinks: null, links: [] }, false],
    [{ hasLinks: 'no', links: [] }, true],
    [{ hasLinks: 'yes', links: [] }, false],
    [{ hasLinks: 'yes', links: [commentary] }, true],
  ] as const)('judges %o complete: %s', (answers, complete) => {
    expect(areLinksComplete({ ...answers, links: [...answers.links] })).toBe(complete);
  });
});

describe('addLink', () => {
  it('adds the typed link at the end of the list, without its surrounding spaces', () => {
    expect(
      addLink([fingertips], {
        linkUrl: '  https://www.gov.uk/statistics ',
        linkText: ' Statistical commentary\n',
      }),
    ).toEqual({ links: [fingertips, commentary] });
  });

  it.each(['https://www.gov.uk', 'http://www.gov.uk/path?query=1#fragment', 'HTTPS://WWW.GOV.UK'])(
    'takes %s as a URL',
    (linkUrl) => {
      expect(addLink([], { linkUrl, linkText: 'A link' })).toEqual({
        links: [{ url: linkUrl, text: 'A link' }],
      });
    },
  );

  it('asks for both fields when neither is typed', () => {
    expect(addLink([], { linkUrl: ' ', linkText: '' })).toEqual({
      fieldErrors: { linkUrl: 'Enter a URL', linkText: 'Enter link text' },
    });
  });

  it.each([
    'www.gov.uk',
    'gov.uk/statistics',
    'ftp://www.gov.uk/file',
    'javascript:alert(1)',
    'mailto:someone@example.com',
    'https://',
    'https://localhost/page',
    'https://www.gov .uk',
  ])('refuses %s as a URL', (linkUrl) => {
    expect(addLink([], { linkUrl, linkText: 'A link' })).toEqual({
      fieldErrors: { linkUrl: 'Enter a URL in the correct format, like https://www.gov.uk' },
    });
  });

  it('refuses a URL or link text that is too long', () => {
    expect(
      addLink([], {
        linkUrl: `https://www.gov.uk/${'a'.repeat(2000 - 19 + 1)}`,
        linkText: 'a'.repeat(201),
      }),
    ).toEqual({
      fieldErrors: {
        linkUrl: 'URL must be 2,000 characters or fewer',
        linkText: 'Link text must be 200 characters or fewer',
      },
    });
  });

  it('takes a URL and link text at their longest', () => {
    const linkUrl = `https://www.gov.uk/${'a'.repeat(2000 - 19)}`;
    const linkText = 'a'.repeat(200);

    expect(addLink([], { linkUrl, linkText })).toEqual({
      links: [{ url: linkUrl, text: linkText }],
    });
  });

  it('refuses a URL already in the list, against the URL', () => {
    expect(addLink([commentary], { linkUrl: commentary.url, linkText: 'Again' })).toEqual({
      fieldErrors: { linkUrl: 'Enter a URL that has not already been added' },
    });
  });

  it('refuses the same address written differently', () => {
    const upper = commentary.url.replace(/^https:\/\/[^/]+/, (origin) => origin.toUpperCase());

    expect(addLink([commentary], { linkUrl: upper, linkText: 'Again' })).toEqual({
      fieldErrors: { linkUrl: 'Enter a URL that has not already been added' },
    });
  });

  it('refuses a link beyond the most the list may hold, against the URL', () => {
    expect(addLink(fullList, { linkUrl: commentary.url, linkText: commentary.text })).toEqual({
      fieldErrors: { linkUrl: 'You cannot add more than 20 links' },
    });
  });
});
