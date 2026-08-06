import { describe, expect, it } from 'vitest';

import { collectSourcemapSources } from './sourcemaps.js';

describe('collectSourcemapSources', () => {
  it('collects the modules a chunk was built from', () => {
    const map = JSON.stringify({
      version: 3,
      sources: [
        '../../packages/public-web-features/src/routes/home.tsx',
        '../../packages/ui/src/app-shell.tsx',
      ],
      mappings: 'AAAA',
    });

    expect(collectSourcemapSources(map, 'home-D8_noEmG.js.map')).toEqual([
      '../../packages/public-web-features/src/routes/home.tsx',
      '../../packages/ui/src/app-shell.tsx',
    ]);
  });

  // A map this cannot read is a chunk left uninspected, so each of these has to be reported rather
  // than read as a chunk holding nothing internal — and has to name the file it came from, because
  // the only thing distinguishing one minified chunk from the next is its path.
  it('names the file it could not parse', () => {
    expect(() => collectSourcemapSources('not json', 'home.js.map')).toThrow(
      /Could not parse the sourcemap at home\.js\.map/,
    );
  });

  it.each([
    ['a map that is not an object', '[]'],
    ['a map declaring no sources', '{"version":3}'],
    ['a map whose sources are not an array', '{"sources":"home.tsx"}'],
    ['a map whose sources are empty', '{"sources":[]}'],
  ])('rejects %s', (_case, map) => {
    expect(() => collectSourcemapSources(map, 'home.js.map')).toThrow(
      /home\.js\.map names no sources/,
    );
  });

  it('rejects a source that is not a string', () => {
    expect(() => collectSourcemapSources('{"sources":["home.tsx",null]}', 'home.js.map')).toThrow(
      /names the source null, which this check cannot read/,
    );
  });
});
