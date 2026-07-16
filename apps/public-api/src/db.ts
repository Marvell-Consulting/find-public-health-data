import { createDb } from '@fphd/db';

import * as config from './config.js';

// Connects as the public_api role.
export const db = createDb(config.db);
