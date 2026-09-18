import { defineConfig } from 'vite';

import { createWebViteConfig } from '../web-config.ts';

export default defineConfig(() =>
  createWebViteConfig({ apiPort: 4000, hmrPort: 24_678, webPort: 3000 }),
);
