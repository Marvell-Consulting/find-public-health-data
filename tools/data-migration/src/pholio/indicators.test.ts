import { describe, expect, it } from 'vitest';

import { notesAndCaveats } from '../notes-and-caveats.ts';
import { stripHtml } from './indicators.ts';

describe('stripHtml', () => {
  it('converts <br> variants to newlines', () => {
    expect(stripHtml('a<br>b')).toBe('a\nb');
    expect(stripHtml('a<br/>b')).toBe('a\nb');
    expect(stripHtml('a<br />b')).toBe('a\nb');
  });

  it('converts <p> to newline and removes </p>', () => {
    expect(stripHtml('<p>hello</p>')).toBe('\nhello');
    expect(stripHtml('<p>a</p><p>b</p>')).toBe('\na\nb');
  });

  it('converts <li> to newline + dash and removes </li>', () => {
    expect(stripHtml('<li>item</li>')).toBe('\n- item');
    expect(stripHtml('<li>a</li><li>b</li>')).toBe('\n- a\n- b');
  });

  it('converts <b> and </b> to **', () => {
    expect(stripHtml('<b>bold</b>')).toBe('**bold**');
  });

  it('converts <strong> and </strong> to **', () => {
    expect(stripHtml('<strong>bold</strong>')).toBe('**bold**');
  });

  it('converts <em> and </em> to *', () => {
    expect(stripHtml('<em>italic</em>')).toBe('*italic*');
  });

  it('converts <i> and </i> to *', () => {
    expect(stripHtml('<i>italic</i>')).toBe('*italic*');
  });

  it('strips remaining unknown tags', () => {
    expect(stripHtml('<div>content</div>')).toBe('content');
    expect(stripHtml('<span class="x">text</span>')).toBe('text');
    expect(stripHtml('<a href="http://x.com">link</a>')).toBe('link');
  });

  it('strips multiple unknown tags iteratively', () => {
    expect(stripHtml('<ul><li>a</li><li>b</li></ul>')).toBe('\n- a\n- b');
  });

  it('returns text unchanged when no tags present', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles mixed content', () => {
    expect(stripHtml('Rate is <b>high</b>.<br>See <a href="#">details</a>.')).toBe(
      'Rate is **high**.\nSee details.',
    );
  });

  it('leaves unclosed tag in place — matching T-SQL BREAK behaviour', () => {
    // T-SQL: if no '>' found, BREAK — the '<' and everything after stays as-is.
    expect(stripHtml('value <5 per thousand')).toBe('value <5 per thousand');
    expect(stripHtml('a <b unclosed')).toBe('a <b unclosed');
  });

  it('handles malformed tag with no closing >', () => {
    // The '<' followed by other '<' before any '>' — T-SQL finds the first '<'
    // then looks for '>' and finds one far later if present.
    // e.g. '<foo<bar>' — T-SQL strips from first '<' to first '>'.
    expect(stripHtml('<foo<bar>text')).toBe('text');
  });

  it('handles nested/malformed html — strips outermost angle-bracket pair', () => {
    // Each iteration strips one < ... > span.
    expect(stripHtml('<a><b>text</b></a>')).toBe('**text**');
  });

  it('case-sensitive: does not match uppercase tags for markdown conversion', () => {
    // T-SQL REPLACE is case-insensitive on SQL Server (default collation), but we
    // reproduce the literal replaceAll which is case-sensitive. Document this.
    // <BR> will NOT be converted to newline — left to be stripped generically.
    expect(stripHtml('<BR>text')).toBe('text');
    expect(stripHtml('<B>bold</B>')).toBe('bold');
  });
});

describe('notes and caveats from Pholio prose', () => {
  it('maps Pholio prose columns to the renamed indicator_version answer columns', () => {
    const result = notesAndCaveats({
      disclosureControl: '<p>Counts under 5 are suppressed.</p>',
      caveats: '<p>Survey data &mdash; use with care.</p>',
      notes: 'None.',
    });
    expect(result).toEqual({
      disclosure_control: 'yes',
      disclosure_control_detail: 'Counts under 5 are suppressed.',
      has_rounding: null,
      rounding_detail: null,
      has_caveats: true,
      caveats_detail: 'Survey data — use with care.',
      has_other_notes: false,
      other_notes_detail: null,
    });
  });

  it('treats a caveats column that is only &nbsp; as unanswered (null)', () => {
    const result = notesAndCaveats({
      disclosureControl: null,
      caveats: '&nbsp;',
      notes: null,
    });
    expect(result.has_caveats).toBeNull();
    expect(result.caveats_detail).toBeNull();
  });

  it('produces null for all answer columns when all prose fields are absent', () => {
    const result = notesAndCaveats({ disclosureControl: null, caveats: null, notes: null });
    expect(result).toEqual({
      disclosure_control: null,
      disclosure_control_detail: null,
      has_rounding: null,
      rounding_detail: null,
      has_caveats: null,
      caveats_detail: null,
      has_other_notes: null,
      other_notes_detail: null,
    });
  });
});
