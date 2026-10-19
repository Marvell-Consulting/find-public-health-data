import { TEAM_IDS } from '@fphd/auth';
import { describe, expect, it } from 'vitest';

import { signedInContext } from '../session.testing.ts';
import { chooseIndicatorTeam, loadIndicatorTeam } from './loader.ts';

const TEAM_PAGE_URL = 'https://internal.test/publish/indicators/new/team';
const BOTH_TEAMS = [TEAM_IDS.teamA, TEAM_IDS.teamB];

async function load(teams: readonly string[]) {
  return loadIndicatorTeam({
    context: await signedInContext(['publisher'], teams),
    params: {},
    request: new Request(TEAM_PAGE_URL),
  } as never);
}

async function choose(team: string | undefined, teams: readonly string[] = BOTH_TEAMS) {
  return chooseIndicatorTeam({
    context: await signedInContext(['publisher'], teams),
    params: {},
    request: new Request(TEAM_PAGE_URL, {
      method: 'POST',
      body: new URLSearchParams(team === undefined ? {} : { team }),
    }),
  } as never);
}

function redirectsToNamePage(thrown: unknown) {
  return (
    thrown instanceof Response &&
    thrown.status === 302 &&
    thrown.headers.get('location') === '/publish/indicators/new'
  );
}

describe('loadIndicatorTeam', () => {
  it("offers a publisher's teams by name", async () => {
    expect(await load([TEAM_IDS.teamB, TEAM_IDS.teamA])).toEqual({
      teams: [
        { id: TEAM_IDS.teamA, name: 'Team A' },
        { id: TEAM_IDS.teamB, name: 'Team B' },
      ],
    });
  });

  it('sends a publisher in one team on to name the indicator, with nothing to choose', async () => {
    await expect(load([TEAM_IDS.teamA])).rejects.toSatisfy(redirectsToNamePage);
  });
});

describe('chooseIndicatorTeam', () => {
  it('goes on to the name page for the team chosen', async () => {
    const outcome = await choose(TEAM_IDS.teamB);

    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).status).toBe(302);
    expect((outcome as Response).headers.get('location')).toBe(
      `/publish/indicators/new?team=${TEAM_IDS.teamB}`,
    );
  });

  it.each([
    ['no team', undefined],
    ['a team the publisher is not in', TEAM_IDS.teamC],
  ])('asks for a team when the choice is %s', async (_case, team) => {
    expect(await choose(team)).toEqual({
      fieldErrors: { team: 'Select which team should own this indicator' },
    });
  });

  it('sends a publisher in one team on to name the indicator', async () => {
    await expect(choose(TEAM_IDS.teamA, [TEAM_IDS.teamA])).rejects.toSatisfy(redirectsToNamePage);
  });
});
