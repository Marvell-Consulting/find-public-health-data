export function searchPattern(query: string): RegExp | undefined {
  const term = query.trim();
  return term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu') : undefined;
}
