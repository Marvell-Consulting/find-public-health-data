import { indicatorPath } from '@fphd/utils/indicator-path';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

export function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) throw redirect('/search', 302);
  const url = new URL(request.url);
  return redirect(`${indicatorPath(slug)}${url.search}`, 302);
}
