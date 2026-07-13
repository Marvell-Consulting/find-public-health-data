import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

import { createWebViteConfig } from '../web-config';

export default defineConfig(() => {
  const config = createWebViteConfig({ apiPort: 4001, hmrPort: 24_679, webPort: 3001 });

  return {
    ...config,
    environments: {
      ssr: {
        build: {
          rollupOptions: {
            input: './server/app.ts',
          },
        },
      },
    },
    plugins: reactRouter(),
  };
});
