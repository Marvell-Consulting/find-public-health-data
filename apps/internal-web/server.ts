import { startReactRouterServer } from '@fphd/web-server';

await startReactRouterServer({ defaultPort: 3001, rootDirectory: import.meta.dirname });
