import { withThrowingDefaults } from '@fphd/db/testing';

import type { InternalRepositories } from './repositories.js';

/** Per-method stubs; anything unstubbed throws, as with `createFakeRepositories` in `@fphd/db`. */
export type FakeInternalRepositoryOverrides = {
  [K in keyof InternalRepositories]?: Partial<InternalRepositories[K]>;
};

export function createFakeInternalRepositories(
  overrides: FakeInternalRepositoryOverrides = {},
): InternalRepositories {
  return {
    topics: withThrowingDefaults('topics', overrides.topics),
  };
}
