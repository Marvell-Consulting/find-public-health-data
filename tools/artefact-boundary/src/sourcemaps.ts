/**
 * The bundle is minified, so a chunk's module identity survives only in its sourcemap's `sources`.
 * Every shape this does not recognise is reported, naming the file it came from, rather than read
 * as a chunk that holds nothing internal — a map it cannot inspect is not a map it has cleared.
 */
export function collectSourcemapSources(raw: string, file: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Could not parse the sourcemap at ${file}.`, { cause });
  }

  const { sources } = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
    sources?: unknown;
  };

  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`The sourcemap at ${file} names no sources; that chunk cannot be inspected.`);
  }

  return sources.map((source) => {
    if (typeof source !== 'string') {
      throw new Error(
        `The sourcemap at ${file} names the source ${JSON.stringify(source)}, which this check cannot read.`,
      );
    }
    return source;
  });
}
