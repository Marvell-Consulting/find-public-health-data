interface WebViteConfigOptions {
  apiPort: number;
  hmrPort: number;
  webPort: number;
}

export function createWebViteConfig({ apiPort, hmrPort, webPort }: WebViteConfigOptions) {
  return {
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: ['if-function' as const, 'import' as const],
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
      cssMinify: 'esbuild' as const,
    },
  };
}

export const webVitestConfig = {
  resolve: {
    alias: {
      '@not-govuk/sass-base': '@not-govuk/sass-base/vite',
    },
  },
  test: {
    environment: 'jsdom' as const,
    server: {
      deps: {
        inline: [/@not-govuk/, /@react-foundry/],
      },
    },
  },
};
