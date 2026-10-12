import { decodeHTML } from 'entities';

const blockBreakTags = new Set(['p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const markupTag =
  /<\/?(?:br|p|div|li|ul|ol|span|a|strong|em|b|i|u|sup|sub|table|tr|td|th|h[1-6])\b[^>]*>/i;
const entity = /&(?:#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/i;

function stripTags(text: string): string {
  const output: string[] = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) {
      output.push(text.slice(index));
      break;
    }
    output.push(text.slice(index, open));
    const closer = text.startsWith('</', open);
    const body = open + (closer ? 2 : 1);
    const close = text.indexOf('>', body);
    if (!/[a-z!]/i.test(text[body] ?? '') || close === -1) {
      output.push('<');
      index = open + 1;
      continue;
    }
    const name = /^[a-z0-9]+/i.exec(text.slice(body, close))?.[0]?.toLowerCase() ?? '';
    if (name === 'br' || (closer && blockBreakTags.has(name))) output.push('\n');
    index = close + 1;
  }
  return output.join('');
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
