import { serviceName } from './app-shell';

export function formatDocumentTitle(pageTitle?: string) {
  return pageTitle ? `${pageTitle} - ${serviceName} - GOV.UK` : `${serviceName} - GOV.UK`;
}
