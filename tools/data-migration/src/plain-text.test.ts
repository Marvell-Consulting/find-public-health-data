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

  it('preserves inequalities and removes emphasis without Markdown markers', () => {
    expect(plainTextFromHtml('<p>aged <16 and >64, <b>high</b> and <em>low</em></p>')).toBe(
      'aged <16 and >64, high and low',
    );
  });

  it.each([
    ['<p>Use values where x<y and z>0.</p>', 'Use values where x<y and z>0.'],
    ['values <a threshold are <b>suppressed</b>', 'values <a threshold are suppressed'],
    ['<p>Use x<b and c>0.</p>', 'Use x<b and c>0.'],
    ['<p class="body">Read <a href="/more?x=1&amp;y=2" title="More">more</a>.</p>', 'Read more.'],
    ['&lt;p&gt;Use x&lt;y and z&gt;0.&lt;/p&gt;', 'Use x<y and z>0.'],
  ])('preserves prose while removing complete supported tags (%s)', (html, expected) => {
    expect(plainTextFromHtml(html)).toBe(expected);
  });

  it('keeps table cells and rows separated', () => {
    expect(
      plainTextFromHtml(
        '<table><tr><th>Count</th><th>Rate</th></tr><tr><td>10</td><td>20</td></tr></table>',
      ),
    ).toBe('Count\tRate\n10\t20');
  });

  it('is empty for prose that holds only markup and spacing', () => {
    expect(plainTextFromHtml('\n&nbsp;')).toBe('');
    expect(plainTextFromHtml('<p> </p>')).toBe('');
  });
});
