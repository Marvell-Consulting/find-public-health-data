import { createDocumentMeta, PageIntro } from '@fphd/ui';
import { data } from 'react-router';

export function loader() {
  return data(null, { status: 403 });
}

export const meta = createDocumentMeta('Access denied');

export default function AccessDeniedPage() {
  return (
    <PageIntro title="Access denied">
      <p className="govuk-body">You do not have permission to manage public health data.</p>
    </PageIntro>
  );
}
