import { createDb } from '@fphd/db';

import * as config from './config.js';

// Connects as the internal_api role.
export const db = createDb(config.db);
