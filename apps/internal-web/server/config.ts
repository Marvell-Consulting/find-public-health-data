import { loadWebServerConfig } from '@fphd/config';

export const { development, host, port, log } = loadWebServerConfig(process.env, { port: 3001 });
