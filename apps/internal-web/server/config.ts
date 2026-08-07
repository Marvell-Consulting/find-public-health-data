import { loadWebServerConfig } from '@fphd/config';

export const { development, host, port, apiUrl, log, session, shutdown } = loadWebServerConfig(
  process.env,
  {
    port: 3001,
    apiUrl: 'http://localhost:4001',
  },
);
