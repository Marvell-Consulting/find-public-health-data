import {
  API_ROLES,
  assertSeedingAllowed,
  bootstrapOwnerRole,
  bootstrapRoles,
  type DatabaseRole,
  rebuildReadModels,
  type SqlClient,
  seedDatabase,
} from '@fphd/db';

import type { Config } from './load-config.js';

/**
 * The role names are fixed — the APIs connect as `public_api` and `internal_api`, and only
 * the passwords are injected — so this maps the two optional config values onto them. It
 * refuses rather than bootstrapping half the pair and reporting success.
 */
export function rolesToBootstrap(roles: Config['roles']): DatabaseRole[] {
  const required = [
    {
      name: API_ROLES.publicApi,
      variable: 'PUBLIC_API_PASSWORD',
      password: roles.publicApiPassword,
    },
    {
      name: API_ROLES.internalApi,
      variable: 'INTERNAL_API_PASSWORD',
      password: roles.internalApiPassword,
    },
  ];

  const missing = required.filter((role) => role.password === undefined);
  if (missing.length > 0) {
    throw new Error(
      `db bootstrap needs ${missing.map((role) => role.variable).join(' and ')} in the environment`,
    );
  }

  return required.flatMap(({ name, password }) =>
    password === undefined ? [] : [{ name, password }],
  );
}

/**
 * The owner group first: `db migrate` sets its role to it, so a database that has never been
 * bootstrapped cannot be migrated.
 */
export async function bootstrap(sql: SqlClient, config: Config): Promise<void> {
  await bootstrapOwnerRole(sql);
  await bootstrapRoles(sql, rolesToBootstrap(config.roles));
}

/**
 * Rebuilds the read models in the same command, unlike the local `db:seed`/
 * `db:rebuild-read-models` pair: a job runs one command, and a seeded database whose read
 * models are still empty serves an empty site.
 */
export async function seed(sql: SqlClient, config: Config): Promise<void> {
  assertSeedingAllowed(config.appEnv);
  await seedDatabase(sql);
  await rebuildReadModels(sql);
}
