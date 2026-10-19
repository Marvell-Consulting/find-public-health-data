import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import { chooseIndicatorTeam, type IndicatorTeamFailure, loadIndicatorTeam } from './loader.ts';
import { IndicatorTeamPage } from './page.tsx';

export const loader = loadIndicatorTeam;

export const action = chooseIndicatorTeam;

export const meta = titleFromPage;

export const handle = backLinkHandle(DASHBOARD_PATH, 'Back to indicators');

export function IndicatorTeamRoute() {
  const { teams } = useLoaderData<typeof loader>();
  const rejected = useActionData<IndicatorTeamFailure | undefined>();

  return <IndicatorTeamPage fieldErrors={rejected?.fieldErrors} teams={teams} />;
}

export default IndicatorTeamRoute;
