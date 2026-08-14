import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type AppliedMigration,
  assertMigratable,
  blockingMigrations,
  compareMigrations,
  type LocalMigration,
  readLocalMigrations,
} from './migration-status.js';

function local(tag: string, folderMillis: number, hash = `hash-${tag}`): LocalMigration {
  return { tag, folderMillis, hash };
}

function applied(createdAt: number, hash: string): AppliedMigration {
  return { createdAt, hash };
}

function stateOf(reports: ReturnType<typeof compareMigrations>, tag: string) {
  return reports.find((report) => report.tag === tag)?.state;
}

describe('compareMigrations', () => {
  it('reports a recorded migration whose hash still matches as applied', () => {
    const reports = compareMigrations([local('0000_a', 100)], [applied(100, 'hash-0000_a')]);

    expect(stateOf(reports, '0000_a')).toBe('applied');
  });

  it('reports an unrecorded migration newer than everything applied as pending', () => {
    const reports = compareMigrations(
      [local('0000_a', 100), local('0001_b', 200)],
      [applied(100, 'hash-0000_a')],
    );

    expect(stateOf(reports, '0001_b')).toBe('pending');
  });

  it('reports every migration as pending against a database with none applied', () => {
    const reports = compareMigrations([local('0000_a', 100), local('0001_b', 200)], []);

    expect(reports.map((report) => report.state)).toEqual(['pending', 'pending']);
  });

  it('reports a migration edited since it was applied as tampered', () => {
    const reports = compareMigrations([local('0000_a', 100)], [applied(100, 'a-different-hash')]);

    expect(stateOf(reports, '0000_a')).toBe('tampered');
  });

  // The state drizzle's migrator cannot see: it compares against the newest applied
  // timestamp, so an older unrecorded migration is passed over silently on every run.
  it('reports an unrecorded migration older than one already applied as skipped', () => {
    const reports = compareMigrations(
      [local('0000_a', 100), local('0001_out_of_order', 150), local('0002_c', 200)],
      [applied(100, 'hash-0000_a'), applied(200, 'hash-0002_c')],
    );

    expect(stateOf(reports, '0001_out_of_order')).toBe('skipped');
  });

  it('reports a recorded migration absent from this build as unknown', () => {
    const reports = compareMigrations(
      [local('0000_a', 100)],
      [applied(100, 'hash-0000_a'), applied(300, 'from-a-newer-build')],
    );

    expect(reports.map((report) => report.state)).toEqual(['applied', 'unknown']);
  });

  it('orders the report by migration timestamp regardless of how it was assembled', () => {
    const reports = compareMigrations(
      [local('0002_c', 200), local('0000_a', 100)],
      [applied(300, 'from-a-newer-build')],
    );

    expect(reports.map((report) => report.folderMillis)).toEqual([100, 200, 300]);
  });
});

describe('assertMigratable', () => {
  it('passes a report of applied and pending migrations', () => {
    const reports = compareMigrations(
      [local('0000_a', 100), local('0001_b', 200)],
      [applied(100, 'hash-0000_a')],
    );

    expect(() => assertMigratable(reports)).not.toThrow();
  });

  it('refuses a tampered migration, naming it', () => {
    const reports = compareMigrations([local('0000_a', 100)], [applied(100, 'a-different-hash')]);

    expect(() => assertMigratable(reports)).toThrow(/0000_a \(tampered\)/);
  });

  it('refuses a migration that would be silently skipped, naming it', () => {
    const reports = compareMigrations(
      [local('0000_a', 100), local('0001_out_of_order', 150)],
      [applied(100, 'hash-0000_a'), applied(200, 'hash-0002_c')],
    );

    expect(() => assertMigratable(reports)).toThrow(/0001_out_of_order \(skipped\)/);
  });

  it('does not refuse a database that is merely ahead of this build', () => {
    const reports = compareMigrations(
      [local('0000_a', 100)],
      [applied(100, 'hash-0000_a'), applied(300, 'newer')],
    );

    expect(blockingMigrations(reports)).toHaveLength(0);
    expect(() => assertMigratable(reports)).not.toThrow();
  });
});

describe('readLocalMigrations', () => {
  it('reads this package’s own migrations, tagged and hashed', () => {
    const migrations = readLocalMigrations();

    expect(migrations.length).toBeGreaterThan(0);
    for (const migration of migrations) {
      expect(migration.tag).toMatch(/^\d{4}_/);
      expect(migration.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(migration.folderMillis).toBeGreaterThan(0);
    }
  });

  it('throws naming the file when the journal is not one, rather than reading past it', () => {
    const folder = mkdtempSync(join(tmpdir(), 'fphd-journal-'));
    mkdirSync(join(folder, 'meta'));
    writeFileSync(join(folder, 'meta', '_journal.json'), '{"entries":[{"when":"not-a-number"}]}');

    expect(() => readLocalMigrations(folder)).toThrow(
      /_journal\.json is not a drizzle migration journal/,
    );

    rmSync(folder, { recursive: true, force: true });
  });
});
