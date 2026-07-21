import { createLogger } from '@fphd/logger';
import { hydrateWebApp } from '@fphd/ui/hydrate';

createLogger({ name: 'internal-web' }).info('Internal web starting');
hydrateWebApp();
