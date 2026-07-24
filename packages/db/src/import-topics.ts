#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseEnv, z } from '@fphd/config';

import { createDb } from './client.js';
import { dbEnvFields } from './env.js';
import { parseTopicsFile } from './topics-import.js';
import { importTopics } from './topics-repository.js';

const envSchema = z.object({
  ...dbEnvFields,
  POSTGRES_USER: z.string().default('fphd'),
  POSTGRES_PASSWORD: z.string().default('fphd'),
});

async function main() {
  const filePath = resolve(process.argv[2] ?? 'data/topics.json');
  const fileTopics = parseTopicsFile(JSON.parse(readFileSync(filePath, 'utf-8')));

  const env = parseEnv(envSchema, process.env);
  const db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  });

  const { summary, orphaned } = await importTopics(db, fileTopics);

  console.log(
    `Imported ${filePath}: ${summary.inserted} inserted, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
  );

  if (orphaned.length > 0) {
    console.warn(
      `Warning: ${orphaned.length} topic(s) in the database are absent from the file and were left in place:`,
    );
    for (const topic of orphaned) {
      console.warn(`  ${topic.id}  ${topic.slug}`);
    }
  }

  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
