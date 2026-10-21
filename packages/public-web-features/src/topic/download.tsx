import { A, Button, Details } from '@fphd/ui';
import { useState } from 'react';

export function TopicDownload({ href }: { href: string }) {
  const [message, setMessage] = useState('');
  return (
    <Details
      summary="Download or share data"
      className="fphd-topic-download govuk-!-margin-bottom-0"
    >
      <p className="govuk-body-s">
        <A forceExternal href={href}>
          Download this table
        </A>{' '}
        as CSV.
      </p>
      <p className="govuk-body-s">
        Share this page to keep the selected tab, filters, sort order and page.
      </p>
      <Button
        className="fphd-topic-copy govuk-button--secondary govuk-!-margin-bottom-0"
        type="button"
        onClick={() => {
          if (!navigator.clipboard) {
            setMessage('Copy the page address from your browser to share this view.');
            return;
          }
          void navigator.clipboard.writeText(window.location.href).then(
            () => setMessage('Link copied'),
            () => setMessage('Copy the page address from your browser to share this view.'),
          );
        }}
      >
        Copy link to this view
      </Button>
      <p role="status" className="govuk-body-s govuk-!-margin-bottom-0">
        {message}
      </p>
      <noscript>
        <p className="govuk-body-s">Copy the page address from your browser to share this view.</p>
      </noscript>
    </Details>
  );
}
