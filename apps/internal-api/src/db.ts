import { createDb } from '@fphd/db';

import { getConfig } from './config.js';

// Connects as the internal_api role.
export const db = createDb(getConfig().db);
