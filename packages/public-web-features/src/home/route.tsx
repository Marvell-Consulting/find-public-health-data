import { createDocumentMeta } from '@fphd/ui';

import { PublicHomePage } from './page';

export const meta = createDocumentMeta('Home');

export function HomeRoute() {
  return <PublicHomePage />;
}

export default HomeRoute;
