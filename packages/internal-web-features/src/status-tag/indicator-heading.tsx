import type { DraftStatus, IndicatorStatus } from '@fphd/internal-api-features/contract';

import { StatusTag } from './status-tag.tsx';

interface IndicatorHeadingProps {
  name: string;
  shortId: number;
  indicatorStatus: IndicatorStatus;
  draftStatus: DraftStatus | null;
}

/** How a publisher's pages title an indicator: its name, its public number, then its statuses. */
export function IndicatorHeading({
  draftStatus,
  indicatorStatus,
  name,
  shortId,
}: IndicatorHeadingProps) {
  return (
    <>
      <h1 className="govuk-heading-xl govuk-!-margin-bottom-2">{name}</h1>
      <p className="govuk-heading-m govuk-!-margin-bottom-2">ID: {shortId}</p>
      <p className="govuk-!-margin-bottom-6">
        <StatusTag type="indicator" status={indicatorStatus} />{' '}
        <StatusTag type="publishing" indicatorStatus={indicatorStatus} draftStatus={draftStatus} />
      </p>
    </>
  );
}
