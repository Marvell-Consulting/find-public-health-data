import type { SqlClient } from '@fphd/db';
import { SEED_TABLES } from '@fphd/db/operations';
import { createLogger } from '@fphd/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandContext } from './commands.ts';
import { importPublishedSnapshot, rolesToBootstrap } from './db-commands.ts';
import type { Config } from './load-config.ts';
import type { PublishedManifest } from './published-snapshot.ts';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  assertCoreData: vi.fn(),
  seedPublished: vi.fn(),
  rebuild: vi.fn(),
  analyze: vi.fn(),
}));

vi.mock('./published-snapshot.ts', () => ({ downloadPublishedSnapshot: mocks.download }));
vi.mock('@fphd/db/operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@fphd/db/operations')>()),
  assertCoreDataPresent: mocks.assertCoreData,
  seedPublishedTables: mocks.seedPublished,
  rebuildReadModelTables: mocks.rebuild,
  analyzeReadModels: mocks.analyze,
}));

afterEach(() => vi.clearAllMocks());

const logger = createLogger({ name: 'operations-test', level: 'silent' });

function publishedContext() {
  let committed = false;
  const tx = { unsafe: vi.fn(async () => [{ count: 0 }]) };
  const sql = {
    begin: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => {
      const result = await run(tx);
      committed = true;
      return result;
    }),
  } as unknown as SqlClient;
  const config = {
    appEnv: 'dev',
    publishedSnapshot: { url: 'https://example.test/snapshot.tar', sha256: 'a'.repeat(64) },
  } as Config;
  return {
    context: { sql, config, logger } satisfies CommandContext,
    tx,
    wasCommitted: () => committed,
  };
}

function publishedManifest(): PublishedManifest {
  return {
    source: 'PHOLIO_LIVE_A-derived fphd_new benchmark clone',
    source_database: 'fphd_new',
    approved_indicators: 1_290,
    source_csv_null: '__FPHD_NULL_5f92c66de4b849b4a717c23f5cbdb8a1__',
    id_mapping: 'deterministic-uuidv7-v1',
    tables: Object.fromEntries(
      SEED_TABLES.map((table) => [table, { rows: 1, bytes: 1, sha256: 'a'.repeat(64) }]),
    ),
  };
}

function seededTables(count: (table: string) => number) {
  return {
    tables: Object.fromEntries(SEED_TABLES.map((table) => [table, count(table)])),
    relationships: { links: 1 },
  };
}

describe('rolesToBootstrap', () => {
  it('pairs each fixed role name with its injected password', () => {
    expect(
      rolesToBootstrap({ publicApiPassword: 'public-pw', internalApiPassword: 'internal-pw' }),
    ).toEqual([
      { name: 'public_api', password: 'public-pw' },
      { name: 'internal_api', password: 'internal-pw' },
    ]);
  });

  it('names every missing password in one error', () => {
    expect(() =>
      rolesToBootstrap({ publicApiPassword: undefined, internalApiPassword: undefined }),
    ).toThrow(/PUBLIC_API_PASSWORD and INTERNAL_API_PASSWORD/);
  });

  it('refuses a half-configured pair rather than bootstrapping one role', () => {
    expect(() =>
      rolesToBootstrap({ publicApiPassword: 'public-pw', internalApiPassword: undefined }),
    ).toThrow(/INTERNAL_API_PASSWORD/);
  });
});

describe('importPublishedSnapshot', () => {
  it('rejects a row count mismatch inside the transaction and cleans up', async () => {
    const { context, tx, wasCommitted } = publishedContext();
    const cleanup = vi.fn(async () => {});
    mocks.download.mockResolvedValue({
      directory: '/tmp/fixture',
      manifest: publishedManifest(),
      cleanup,
    });
    mocks.seedPublished.mockResolvedValue(
      seededTables((table) => (table === 'observation' ? 2 : 1)),
    );

    await expect(importPublishedSnapshot(context)).rejects.toThrow(
      'Published snapshot row count failed for observation',
    );
    expect(wasCommitted()).toBe(false);
    expect(tx.unsafe).not.toHaveBeenCalled();
    expect(mocks.rebuild).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('loads published tables, rebuilds read models and cleans up', async () => {
    const { context, tx, wasCommitted } = publishedContext();
    const cleanup = vi.fn(async () => {});
    mocks.download.mockResolvedValue({
      directory: '/tmp/fixture',
      manifest: publishedManifest(),
      cleanup,
    });
    mocks.seedPublished.mockResolvedValue(seededTables(() => 1));

    await importPublishedSnapshot(context);

    expect(mocks.seedPublished).toHaveBeenCalledWith(tx, '/tmp/fixture');
    expect(tx.unsafe).toHaveBeenCalledTimes(SEED_TABLES.length + 1);
    expect(mocks.rebuild).toHaveBeenCalledWith(tx);
    expect(wasCommitted()).toBe(true);
    expect(mocks.analyze).toHaveBeenCalledWith(context.sql);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('rejects unapproved indicators before committing the imported snapshot', async () => {
    const { context, tx, wasCommitted } = publishedContext();
    const cleanup = vi.fn(async () => {});
    mocks.download.mockResolvedValue({
      directory: '/tmp/fixture',
      manifest: publishedManifest(),
      cleanup,
    });
    mocks.seedPublished.mockResolvedValue(seededTables(() => 1));
    tx.unsafe.mockResolvedValueOnce([{ count: 1 }]);

    await expect(importPublishedSnapshot(context)).rejects.toThrow(
      'Published snapshot contains an unapproved indicator',
    );
    expect(wasCommitted()).toBe(false);
    expect(mocks.rebuild).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
