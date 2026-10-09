import { describe } from 'vitest';

import { itBehavesAsBlobStorage } from './blob-storage.testing.ts';
import { createFakeBlobStorage } from './testing.ts';

describe('createFakeBlobStorage', () => {
  itBehavesAsBlobStorage(createFakeBlobStorage());
});
