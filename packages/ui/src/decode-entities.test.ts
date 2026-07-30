import { describe, expect, it } from 'vitest';

import { decodeEntities } from './decode-entities';

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
