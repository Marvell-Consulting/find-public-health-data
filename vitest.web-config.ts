import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

/**
 * Shared by every project that renders React components in its tests: the web apps and the
 * packages that own the components. Vitest does not pass the root config's `test` options
 * down to projects, so each of them re-exports this as its own config.
 *
 * `@not-govuk` and `@react-foundry` ship as ESM that Node cannot load directly, so they are
 * inlined for Vite to transform; the sass-base alias matches the one in the apps' Vite config.
 */
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
