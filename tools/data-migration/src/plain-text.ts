import { decodeHTML } from 'entities';

const blockBreakTags = new Set(['p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const tagNames =
  'br|p|div|li|ul|ol|span|a|strong|em|b|i|u|sup|sub|table|thead|tbody|tfoot|tr|td|th|h[1-6]';
const attribute = String.raw`\s+[a-z_:][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'|[^\s"'=<>\x60]+)`;
const tagToken = String.raw`<(\/?)(${tagNames})(?:${attribute})*\s*\/?>`;
const markupTag = new RegExp(tagToken, 'i');
const entity = /&(?:#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/i;

function stripTags(text: string): string {
  return text.replace(new RegExp(tagToken, 'gi'), (_tag, closing: string, rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'br' || (closing && blockBreakTags.has(name))) return '\n';
    if (closing && (name === 'td' || name === 'th')) return '\t';
    return '';
  });
}

export function plainTextFromHtml(text: string): string {
  let plain = decodeHTML(stripTags(text));
  // Some Pholio prose was HTML-escaped twice, so one pass leaves markup or entities behind.
  if (markupTag.test(plain) || entity.test(plain)) plain = decodeHTML(stripTags(plain));
  return plain
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
