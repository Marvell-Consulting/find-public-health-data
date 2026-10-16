import { describe, expect, it } from 'vitest';

import { FOREIGN_KEYS, foreignKeyIndexes, TABLE_TAGS, TABLES } from './tables.ts';

describe('TABLES', () => {
  it('does not include the polarity lookup table', () => {
    expect(TABLES).not.toContain('polarity');
  });

  it('does not include the frequency lookup table', () => {
    expect(TABLES).not.toContain('frequency');
  });
});

describe('FOREIGN_KEYS indicator_version', () => {
  it('does not reference polarity_id (inlined as a value column)', () => {
    expect(Object.keys(FOREIGN_KEYS.indicator_version ?? {})).not.toContain('polarity_id');
  });

  it('does not reference frequency_id (inlined as update_frequency value column)', () => {
    expect(Object.keys(FOREIGN_KEYS.indicator_version ?? {})).not.toContain('frequency_id');
  });
});

describe('TABLE_TAGS', () => {
  it('assigns a stable tag to every table in TABLES', () => {
    for (const table of TABLES) {
      expect(TABLE_TAGS[table]).toBeGreaterThan(0);
    }
  });

  it('keeps the tags the Python transform used, so published ids do not move', () => {
    expect(TABLE_TAGS.frequency).toBe(6);
    expect(TABLE_TAGS.indicator).toBe(15);
    expect(TABLE_TAGS.indicator_version).toBe(16);
  });

  it('gives indicator and indicator_version adjacent tags', () => {
    const indicatorTag = TABLE_TAGS.indicator ?? 0;
    const versionTag = TABLE_TAGS.indicator_version ?? 0;
    expect(indicatorTag).toBeGreaterThan(0);
    expect(versionTag).toBeGreaterThan(0);
    expect(versionTag - indicatorTag).toBe(1);
  });
});

describe('foreignKeyIndexes', () => {
  it('gives each foreign-key column its position and referenced table', () => {
    expect(
      foreignKeyIndexes('observation_note', ['id', 'note_type_id', 'text', 'observation_id']),
    ).toEqual(
      expect.arrayContaining([
        [3, 'observation'],
        [1, 'note_type'],
      ]),
    );
  });

  it('refuses a table missing one of its foreign-key columns, naming it', () => {
    expect(() => foreignKeyIndexes('observation_note', ['id', 'observation_id'])).toThrow(
      'observation_note is missing foreign-key columns: note_type_id',
    );
  });

  it('needs nothing of a table with no foreign keys', () => {
    expect(foreignKeyIndexes('indicator', ['id', 'created_at'])).toEqual([]);
  });
});
