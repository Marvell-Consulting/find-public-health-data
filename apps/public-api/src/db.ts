import { createDb } from '@fphd/db';

import * as config from './config.ts';

// Connects as the public_api role.
export const db = createDb(config.db);
