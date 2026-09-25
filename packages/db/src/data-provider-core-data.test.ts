import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type DataProviderRecord, parseDataProvidersFile } from './data-provider-core-data.ts';

const ons: DataProviderRecord = {
  id: '01a0d858-9885-764e-8d53-6826aec67001',
  name: 'Office for National Statistics (ONS)',
  sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Live births' }],
};

const committedFile = fileURLToPath(new URL('../data/data-providers.json', import.meta.url));

describe('parseDataProvidersFile', () => {
  it('accepts a well-formed file, including a provider with no named sources', () => {
    const providers = [
      ons,
      { id: '01a0d858-9885-764e-8d53-6826aec67003', name: 'Estimated', sources: [] },
    ];

    expect(parseDataProvidersFile(providers)).toEqual(providers);
  });

  it('rejects an id that is not UUIDv7', () => {
    expect(() =>
      parseDataProvidersFile([{ ...ons, id: '8b7e4a52-9c1d-4f6e-8a3b-2d5c9e7f1a04' }]),
    ).toThrow(/Invalid/);
  });

  it('rejects an id repeated between a provider and a source', () => {
    const source = ons.sources[0];
    if (!source) throw new Error('no source');

    expect(() => parseDataProvidersFile([{ ...ons, id: source.id }])).toThrow(/duplicate id/);
  });

  it('rejects a repeated provider name, and a source named twice under one provider', () => {
    expect(() =>
      parseDataProvidersFile([
        ons,
        { ...ons, id: '01a0d858-9885-764e-8d53-6826aec67004', sources: [] },
      ]),
    ).toThrow(/duplicate name/);
    expect(() =>
      parseDataProvidersFile([
        {
          ...ons,
          sources: [
            ...ons.sources,
            { id: '01a0d858-9885-764e-8d53-6826aec67005', name: 'Live births' },
          ],
        },
      ]),
    ).toThrow(/duplicate source of Office for National Statistics \(ONS\): Live births/);
  });

  it('accepts the committed file', () => {
    expect(() =>
      parseDataProvidersFile(JSON.parse(readFileSync(committedFile, 'utf-8'))),
    ).not.toThrow();
  });
});
