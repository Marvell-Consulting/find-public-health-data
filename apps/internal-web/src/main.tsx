import '@fphd/ui/styles.css';

import { createLogger } from '@fphd/logger';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { internalRouter } from './router';

const logger = createLogger({ name: 'internal-web' });
logger.info('Internal web starting');

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={internalRouter} />
  </StrictMode>,
);
