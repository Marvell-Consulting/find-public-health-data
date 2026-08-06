import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseEnv, z } from '@fphd/config';

import { createDb } from '../client.js';
import { dbEnvFields, resolveDbSsl } from '../env.js';
import { upsertTopics } from '../topic-repository.js';
import { parseTopicsFile } from './parse-topics-file.js';

const envSchema = z.object({
  ...dbEnvFields,
  APP_ENV: z.string().default('local'),
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
    ssl: resolveDbSsl(env.APP_ENV, env.DB_SSL),
  });

  try {
    const { summary, orphaned } = await upsertTopics(db, fileTopics);

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
  } finally {
    // Without this a failed import leaves the socket open and the process hanging.
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
