import { startReactRouterServer } from '@fphd/web-server';

await startReactRouterServer({ defaultPort: 3000, rootDirectory: import.meta.dirname });
