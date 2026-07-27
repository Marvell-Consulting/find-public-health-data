import { loadWebServerConfig } from '@fphd/config';

export const { development, host, port, log, session } = loadWebServerConfig(process.env, {
  port: 3000,
});
