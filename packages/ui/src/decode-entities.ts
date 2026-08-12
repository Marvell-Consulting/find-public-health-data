const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  pound: '£',
  quot: '"',
};

/**
 * Pholio prose arrives with HTML entities baked into text columns (`&hellip;`, `&nbsp;`),
 * which React would otherwise render literally. Decoding happens on the way to the screen
 * rather than in the database so the stored value stays faithful to the source export.
 */
/**
 * A numeric reference the source got wrong is left as written rather than decoded, so a
 * malformed entity shows as itself instead of throwing part-way through a page render.
 */
function fromCodePoint(value: number, match: string): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : match;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.toLowerCase().startsWith('#x')) {
      return fromCodePoint(Number.parseInt(code.slice(2), 16), match);
    }
    if (code.startsWith('#')) {
      return fromCodePoint(Number.parseInt(code.slice(1), 10), match);
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}
