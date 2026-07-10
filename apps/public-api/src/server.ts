import { createApp } from './app.js';

const defaultPort = 4000;
const configuredPort = process.env.PORT;
const port = configuredPort === undefined ? defaultPort : Number(configuredPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`PORT must be an integer between 1 and 65535; received ${configuredPort}`);
}

createApp().listen(port, '0.0.0.0', () => {
  console.log(`Public API listening on port ${port}`);
});
