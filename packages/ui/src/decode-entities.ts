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

// Closing one of these, or a <br>, marks a paragraph-level break in the source prose.
const BLOCK_BREAK_TAGS = new Set(['p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Fingertips metadata arrives as HTML — including Word's mso-* soup — which React would
 * show literally. Block-level closers become line breaks (the metadata styles preserve
 * them via `white-space: pre-line`), every other tag is dropped, and entities are decoded
 * afterwards so a decoded "&lt;" in prose is never mistaken for markup.
 *
 * Tags are removed in one left-to-right pass rather than by regex rewriting: a repeated
 * rewrite can be tricked into assembling markup out of its own deletions, and the
 * backtracking regexes are what CodeQL flags for polynomial blow-up. A "<" that does not
 * open a plausible tag (as in "aged <75 years") is kept as text, as HTML itself would.
 */
export function plainTextFromHtml(text: string): string {
  let stripped = '';
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) {
      stripped += text.slice(index);
      break;
    }
    stripped += text.slice(index, open);
    const body = text.startsWith('</', open) ? open + 2 : open + 1;
    if (!/[a-z!]/i.test(text[body] ?? '')) {
      // Not a tag — a bare less-than in prose. Emit it and carry on.
      stripped += '<';
      index = open + 1;
      continue;
    }
    const close = text.indexOf('>', body);
    if (close === -1) {
      // An unterminated tag swallows the rest, as a browser would treat it.
      break;
    }
    const isCloser = text[open + 1] === '/';
    const name = (/^[a-z0-9]+/i.exec(text.slice(body, close))?.[0] ?? '').toLowerCase();
    if (name === 'br' || (isCloser && BLOCK_BREAK_TAGS.has(name))) {
      stripped += '\n';
    }
    index = close + 1;
  }
  return decodeEntities(stripped)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
