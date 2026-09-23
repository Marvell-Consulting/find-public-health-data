import type { IndicatorAdminDetail } from '@fphd/internal-api-features/contract';

import { StatusTag } from './status-tag.tsx';

type HeadedIndicator = Pick<
  IndicatorAdminDetail,
  'name' | 'shortId' | 'indicatorStatus' | 'draftStatus'
>;

/** How a publisher's pages title an indicator: its name, its public number, then its statuses. */
export function IndicatorHeading({ indicator }: { indicator: HeadedIndicator }) {
  const { draftStatus, indicatorStatus, name, shortId } = indicator;

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
