import { describe, expect, it } from 'vitest';

import { decodeEntities, plainTextFromHtml } from './decode-entities';

describe('decodeEntities', () => {
  it('decodes the named entities Pholio prose contains', () => {
    expect(decodeEntities('0 to 4, 5 to 9,&hellip;, 70 to 74')).toBe('0 to 4, 5 to 9,…, 70 to 74');
    expect(decodeEntities('deaths.&nbsp;To ensure')).toBe('deaths. To ensure');
    expect(decodeEntities('Byar&apos;s method')).toBe("Byar's method");
  });

  it('decodes decimal and hexadecimal references', () => {
    expect(decodeEntities('&#8230;')).toBe('…');
    expect(decodeEntities('&#x2026;')).toBe('…');
  });

  it('leaves text that only looks like an entity alone', () => {
    expect(decodeEntities('rate &notanentity; per 100,000')).toBe('rate &notanentity; per 100,000');
    expect(decodeEntities('under 75s & over')).toBe('under 75s & over');
  });
});

describe('malformed references', () => {
  it('leaves a numeric reference the source got wrong as written', () => {
    // String.fromCodePoint throws on these, which would take the whole render down.
    expect(decodeEntities('rate &#xZZ; per 100,000')).toBe('rate &#xZZ; per 100,000');
    expect(decodeEntities('&#1114112;')).toBe('&#1114112;');
  });
});

describe('plainTextFromHtml', () => {
  it('drops tags and turns block closers into line breaks', () => {
    expect(
      plainTextFromHtml(
        '<span style="mso-fareast-font-family: Calibri;">Fraction of mortality.</span><br /><br /><p>PM<sub>2.5</sub> is fine particulate matter.</p>',
      ),
    ).toBe('Fraction of mortality.\n\nPM2.5 is fine particulate matter.');
  });

  it('keeps a bare less-than in prose', () => {
    expect(plainTextFromHtml('rate in those aged <75 years')).toBe('rate in those aged <75 years');
  });

  it('decodes entities after stripping', () => {
    expect(plainTextFromHtml('<p>10&nbsp;&ndash;&nbsp;20</p>')).toBe('10 – 20');
  });
});
