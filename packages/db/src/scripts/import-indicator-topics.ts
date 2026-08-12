import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { appEnvFields, parseEnv, z } from '@fphd/config';

import { createDb } from '../client.js';
import { dbEnvFields, resolveDbTls } from '../env.js';
import { importIndicatorTopics, parseIndicatorTopicFile } from '../indicator-topic-repository.js';

const envSchema = z.object({
  ...dbEnvFields,
  ...appEnvFields,
  POSTGRES_USER: z.string().default('fphd'),
  POSTGRES_PASSWORD: z.string().default('fphd'),
});

// The three files are separate concerns but a single import: they all key off the same
// indicators, so importing one without the others would leave the page half-populated.
const SEED_FILES = [
  'data/indicator-topics.json',
  'data/indicator-classifications.json',
  'data/indicator-data-updated.json',
];

async function main() {
  const filePaths = process.argv.length > 2 ? process.argv.slice(2) : SEED_FILES;
  const merged: Record<string, unknown> = {};
  for (const path of filePaths) {
    Object.assign(merged, JSON.parse(readFileSync(resolve(path), 'utf-8')));
  }
  const file = parseIndicatorTopicFile(merged);

  const env = parseEnv(envSchema, process.env);
  const db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });

  try {
    const summary = await importIndicatorTopics(db, file);

    console.log(
      `Imported ${filePaths.join(', ')}: ${summary.links} topic links, ${summary.classifications} classifications, ${summary.classificationLinks} classification links, ${summary.timestamps} data timestamps.`,
    );

    if (summary.unknownTopics.length > 0) {
      console.warn(
        `Warning: ${summary.unknownTopics.length} topic slug(s) in the file are not in this database and were skipped: ${summary.unknownTopics.join(', ')}`,
      );
    }
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
