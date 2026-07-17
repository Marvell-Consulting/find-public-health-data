import { createLogger } from '@fphd/logger';
import { hydrateWebApp } from '@fphd/ui/hydrate';

createLogger({ name: 'public-web' }).info('Public web starting');
hydrateWebApp();
