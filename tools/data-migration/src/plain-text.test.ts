import { describe, expect, it } from 'vitest';

import { plainTextFromHtml } from './plain-text.ts';

describe('plainTextFromHtml', () => {
  it.each([
    ['&ge;', '≥'],
    ['&le;', '≤'],
    ['&frac12;', '½'],
    ['&frac14;', '¼'],
    ['&middot;', '·'],
    ['&times;', '×'],
    ['&Sigma;', 'Σ'],
    ['&sigma;', 'σ'],
    ['&sum;', '∑'],
    ['&sup2;', '²'],
    ['&auml;', 'ä'],
    ['&eacute;', 'é'],
    ['&ccedil;', 'ç'],
    ['&deg;', '°'],
    ['&sect;', '§'],
    ['&copy;', '©'],
    ['&ldquo;', '“'],
    ['&rdquo;', '”'],
    ['&#8805;', '≥'],
    ['&#x2265;', '≥'],
  ])('decodes %s, as found in Pholio prose, to %s', (encoded, decoded) => {
    expect(plainTextFromHtml(`aged ${encoded} 65`)).toBe(`aged ${decoded} 65`);
  });

  it('turns a non-breaking space into a plain one', () => {
    expect(plainTextFromHtml('per&nbsp;100,000')).toBe('per 100,000');
  });

  it('decodes prose that was HTML-escaped twice', () => {
    expect(
      plainTextFromHtml(
        'Rates are calculated using unrounded counts.&lt;br /&gt;Values relating to City of London',
      ),
    ).toBe('Rates are calculated using unrounded counts.\nValues relating to City of London');
    expect(plainTextFromHtml('per&amp;nbsp;100,000')).toBe('per 100,000');
  });

  it('decodes an escaped ampersand once, leaving the text it stands for', () => {
    expect(plainTextFromHtml('Accident &amp; Emergency')).toBe('Accident & Emergency');
  });

  it('keeps a less-than sign that starts no tag', () => {
    expect(plainTextFromHtml('rates &lt; 5 and counts < 10')).toBe('rates < 5 and counts < 10');
    expect(plainTextFromHtml('values <a threshold are suppressed')).toBe(
      'values <a threshold are suppressed',
    );
  });

  it('is empty for prose that holds only markup and spacing', () => {
    expect(plainTextFromHtml('\n&nbsp;')).toBe('');
    expect(plainTextFromHtml('<p> </p>')).toBe('');
  });
});
