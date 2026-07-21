import { loadConfig } from './load-config.ts';

// Parses the real environment once, at import — a misconfigured process fails here, at
// startup. Import as `import * as config from './server/config.ts'`.
export const { appEnv, development, host, port, log } = loadConfig(process.env);
