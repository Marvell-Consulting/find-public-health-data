import { defineConfig } from 'vite';

import { createWebViteConfig } from '../web-config';

export default defineConfig(() =>
  createWebViteConfig({ apiPort: 4001, hmrPort: 24_679, webPort: 3001 }),
);
