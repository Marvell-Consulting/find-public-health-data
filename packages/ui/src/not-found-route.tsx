import { data } from 'react-router';

import { NotFoundPage } from './content-page';
import { createDocumentMeta } from './document-title';

export function loader() {
  return data(null, { status: 404 });
}

export const meta = createDocumentMeta('Page not found');

export default NotFoundPage;
