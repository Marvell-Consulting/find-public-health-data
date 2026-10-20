import { teamsForNewIndicator } from '@fphd/auth/permissions';
import { getSession } from '@fphd/web-server/session';
import { type RouterContext, redirect } from 'react-router';

import { NEW_INDICATOR_TEAM_PATH } from './publish-paths.ts';

type SessionReader = { get<T>(context: RouterContext<T>): T };

/** The teams the signed-in user may put a new indicator in. */
export function newIndicatorTeams(context: SessionReader): readonly string[] {
  const session = getSession(context);

  return session === undefined ? [] : teamsForNewIndicator(session);
}

/**
 * The team a new indicator joins: the user's only team, or the one of theirs the address names.
 * A user in several teams who has not chosen is sent to choose; one in none has no such page.
 */
export function requireNewIndicatorTeam(context: SessionReader, request: Request): string {
  const teams = newIndicatorTeams(context);
  const named = new URL(request.url).searchParams.get('team');
  const chosen = teams.length === 1 ? teams[0] : teams.find((team) => team === named);

  if (chosen !== undefined) return chosen;
  if (teams.length === 0) throw new Response('Not Found', { status: 404 });

  throw redirect(NEW_INDICATOR_TEAM_PATH);
}
