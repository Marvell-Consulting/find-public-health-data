import { data } from 'react-router';

import { NotFoundPage } from './content-page';
import { formatDocumentTitle } from './document-title';

export function loader() {
  return data(null, { status: 404 });
}

export const meta = () => [{ title: formatDocumentTitle('Page not found') }];

export default NotFoundPage;
