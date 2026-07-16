import { loadConfig } from './load-config.js';

// Parses the real environment once, at import — a misconfigured process fails here, at
// startup. Import as `import * as config from './config.js'`.
export const { appEnv, host, port, log, db } = loadConfig(process.env);
