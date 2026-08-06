import { loadConfig } from './load-config.js';

// Parses the real environment once, at import — a misconfigured job fails here, before any
// command touches the database. Import as `import * as config from './config.js'`.
export const { appEnv, log, db, roles } = loadConfig(process.env);
