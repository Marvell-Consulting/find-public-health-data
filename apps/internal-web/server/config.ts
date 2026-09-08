import { loadWebServerConfig } from '@fphd/config';

export const {
  development,
  host,
  port,
  apiUrl,
  trustedProxyHops,
  log,
  session,
  webSession,
  shutdown,
} = loadWebServerConfig(process.env, {
  port: 3001,
  apiUrl: 'http://localhost:4001',
});
