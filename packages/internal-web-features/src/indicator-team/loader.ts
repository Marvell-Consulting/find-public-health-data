// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import { TEAMS, type Team } from '@fphd/auth';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import type { FormRefusal } from '../form-refusal.ts';
import { newIndicatorTeams } from '../new-indicator-team.ts';
import { NEW_INDICATOR_PATH, newIndicatorPath } from '../publish-paths.ts';

export const TEAM_FIELD = 'team';

export type IndicatorTeamFailure = FormRefusal<typeof TEAM_FIELD>;

const CHOOSE_A_TEAM = 'Select which team should own this indicator';

/** The user's teams to choose from; with only one there is no choice, so the name page is next. */
function teamsToChooseFrom(context: LoaderFunctionArgs['context']): readonly Team[] {
  const teams = newIndicatorTeams(context);

  if (teams.length < 2) throw redirect(NEW_INDICATOR_PATH);

  return TEAMS.filter((team) => teams.includes(team.id));
}

export function loadIndicatorTeam({ context }: LoaderFunctionArgs) {
  return { teams: teamsToChooseFrom(context) };
}

/** Carries the chosen team to the name page, where the indicator is created in it. */
export async function chooseIndicatorTeam({
  context,
  request,
}: ActionFunctionArgs): Promise<IndicatorTeamFailure | Response> {
  const teams = teamsToChooseFrom(context);
  const chosen = (await request.formData()).get(TEAM_FIELD);
  const team = teams.find(({ id }) => id === chosen);

  if (team === undefined) return { fieldErrors: { [TEAM_FIELD]: CHOOSE_A_TEAM } };

  return redirect(newIndicatorPath(team.id));
}
