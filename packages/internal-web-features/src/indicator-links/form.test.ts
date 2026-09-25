import { describe, expect, it } from 'vitest';

import {
  type LinksPageValues,
  linkFieldName,
  readLinksForm,
  removeLinkIntent,
  withLinkAdded,
  withLinkRemoved,
} from './form.ts';

const commentary = { url: 'https://www.gov.uk/statistics', text: 'Statistical commentary' };
const fingertips = { url: 'https://fingertips.phe.org.uk/', text: 'Fingertips' };

const empty: LinksPageValues = { hasLinks: '', links: [], linkUrl: '', linkText: '' };

function formData(fields: Record<string, string>, links: { url: string; text: string }[] = []) {
  const data = new FormData();

  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  links.forEach(({ url, text }, index) => {
    data.set(linkFieldName(index, 'url'), url);
    data.set(linkFieldName(index, 'text'), text);
  });

  return data;
}

describe('readLinksForm', () => {
  it('reads the answers, the links carried in order and the fields as typed', () => {
    expect(
      readLinksForm(
        formData({ hasLinks: 'yes', linkUrl: ' typed ', linkText: '' }, [commentary, fingertips]),
      ).values,
    ).toEqual({
      hasLinks: 'yes',
      links: [commentary, fingertips],
      linkUrl: ' typed ',
      linkText: '',
    });
  });

  it('reads a field the browser did not send, such as an unchosen radio, as empty', () => {
    expect(readLinksForm(new FormData()).values).toEqual(empty);
  });

  it.each([
    [{ intent: 'add' }, { to: 'add' }],
    [{ intent: removeLinkIntent(1) }, { to: 'remove', index: 1 }],
    [{}, { to: 'continue' }],
    [{ intent: 'something-else' }, { to: 'continue' }],
  ])('reads the button that sent %o', (fields, intent) => {
    expect(readLinksForm(formData(fields)).intent).toEqual(intent);
  });

  it('refuses a carried link the page would not have written', () => {
    let refusal: unknown;

    try {
      readLinksForm(formData({}, [{ url: 'javascript:alert(1)', text: 'A link' }]));
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(Response);
    expect((refusal as Response).status).toBe(400);
  });
});

describe('withLinkAdded', () => {
  it('adds the typed link at the end of the list and clears the fields, answering "Yes"', () => {
    expect(
      withLinkAdded({
        ...empty,
        links: [fingertips],
        linkUrl: commentary.url,
        linkText: commentary.text,
      }),
    ).toEqual({
      values: { hasLinks: 'yes', links: [fingertips, commentary], linkUrl: '', linkText: '' },
      fieldErrors: {},
    });
  });

  it('keeps what was typed when the link is refused', () => {
    const values = { ...empty, hasLinks: 'yes', links: [fingertips], linkUrl: 'www.gov.uk' };

    expect(withLinkAdded(values)).toEqual({
      values,
      fieldErrors: {
        linkUrl: 'Enter a URL in the correct format, like https://www.gov.uk',
        linkText: 'Enter link text',
      },
    });
  });
});

describe('withLinkRemoved', () => {
  it('removes the link at the index, keeping the others in order and anything typed', () => {
    const values = {
      hasLinks: 'yes',
      links: [commentary, fingertips, { url: 'https://www.gov.uk/', text: 'GOV.UK' }],
      linkUrl: 'typed',
      linkText: '',
    };

    expect(withLinkRemoved(values, 1)).toEqual({
      values: { ...values, links: [commentary, { url: 'https://www.gov.uk/', text: 'GOV.UK' }] },
      fieldErrors: {},
    });
  });

  it('changes nothing for an index the list does not hold', () => {
    const values = { ...empty, links: [commentary] };

    expect(withLinkRemoved(values, 3)).toEqual({ values, fieldErrors: {} });
  });
});
