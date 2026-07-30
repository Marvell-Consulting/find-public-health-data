import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseEnv, z } from '@fphd/config';

import { createDb } from '../client.js';
import { importCollections, parseCollectionsFile } from '../collection-repository.js';
import { dbEnvFields } from '../env.js';

const envSchema = z.object({
  ...dbEnvFields,
  POSTGRES_USER: z.string().default('fphd'),
  POSTGRES_PASSWORD: z.string().default('fphd'),
});

async function main() {
  const filePath = resolve(process.argv[2] ?? 'data/indicator-collections.json');
  const file = parseCollectionsFile(JSON.parse(readFileSync(filePath, 'utf-8')));

  const env = parseEnv(envSchema, process.env);
  const db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  });

  try {
    const summary = await importCollections(db, file);

    console.log(
      `Imported ${filePath}: ${summary.collections} collections, ${summary.links} indicator links, ${summary.timestamps} data timestamps.`,
    );

    if (summary.unknownIndicators.length > 0) {
      console.warn(
        `Warning: ${summary.unknownIndicators.length} indicator(s) in the file are not in this database and were skipped: ${summary.unknownIndicators.join(', ')}`,
      );
    }
  } finally {
    // Without this a failed import leaves the socket open and the process hanging.
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
