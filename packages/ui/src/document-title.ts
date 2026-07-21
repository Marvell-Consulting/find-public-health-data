import type { MetaFunction } from 'react-router';

import { serviceName } from './app-shell';

export function formatDocumentTitle(pageTitle?: string) {
  return pageTitle ? `${pageTitle} - ${serviceName} - GOV.UK` : `${serviceName} - GOV.UK`;
}

export function createDocumentMeta(pageTitle?: string): MetaFunction {
  return () => [{ title: formatDocumentTitle(pageTitle) }];
}
