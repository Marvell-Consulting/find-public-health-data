import { createContext } from 'react-router';

import type { ApiClient } from './api-client.js';

/**
 * The API client a loader should use. Holding the client rather than a base URL means no
 * feature builds its own request, so path encoding, timeouts, error mapping and response
 * validation are decided in one place.
 */
export const apiContext = createContext<ApiClient>();
