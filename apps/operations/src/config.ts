import { loadConfig } from './load-config.ts';

// Parses the real environment once, at import — a misconfigured job fails here, before any
// command touches the database. Import as `import * as config from './config.ts'`.
export const { appEnv, log, db, roles, publishedSnapshot } = loadConfig(process.env);
