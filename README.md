# Find Public Health Data

A pnpm monorepo containing four independently deployable applications:

| Application | Package | Default port |
| --- | --- | ---: |
| Public web | `@fphd/public-web` | 3000 |
| Internal web | `@fphd/internal-web` | 3001 |
| Public API | `@fphd/public-api` | 4000 |
| Internal API | `@fphd/internal-api` | 4001 |

The internal applications are functional supersets of the public applications through shared
workspace packages. Deployable applications do not import one another.

## Requirements

- Node.js 24.18.0 LTS
- pnpm 11.11.0

Corepack will select the pinned pnpm version from `package.json`.

## Commands

```sh
pnpm install
pnpm dev
pnpm dev:public
pnpm dev:internal
pnpm check
pnpm build
```

Each application builds to its own `dist` directory, giving CI and deployment tooling four
unambiguous artifacts.

## Structure

```text
apps/
  public-web/
  internal-web/
  public-api/
  internal-api/
packages/
  ui/
  public-web-features/
  internal-web-features/
```

Application directories contain deployment wiring, routes, and entrypoints. Reusable business and
feature logic belongs in workspace packages.
