import type { Config } from '@react-router/dev/config';
import { reactRouter } from '@react-router/dev/vite';
import type { UserConfig } from 'vite';
import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

interface WebViteConfigOptions {
  apiPort: number;
  hmrPort: number;
  webPort: number;
}

export function createWebViteConfig({
  apiPort,
  hmrPort,
  webPort,
}: WebViteConfigOptions): UserConfig {
  return {
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: ['if-function', 'import'],
        },
      },
    },
    resolve: {
      alias: {
        '@not-govuk/sass-base': '@not-govuk/sass-base/vite',
      },
    },
    ssr: {
      noExternal: [/@not-govuk/, /@react-foundry/],
    },
    server: {
      hmr: {
        port: hmrPort,
      },
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
    build: {
      cssMinify: 'esbuild',
    },
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
}

export const reactRouterConfig = {
  appDirectory: 'src',
  buildDirectory: 'dist',
  ssr: true,
} satisfies Config;

export const webVitestConfig = {
  resolve: {
    alias: {
      '@not-govuk/sass-base': '@not-govuk/sass-base/vite',
    },
  },
  test: {
    environment: 'jsdom',
    server: {
      deps: {
        inline: [/@not-govuk/, /@react-foundry/],
      },
    },
  },
} satisfies VitestUserConfig;
