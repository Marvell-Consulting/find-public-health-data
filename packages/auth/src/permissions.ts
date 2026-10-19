import type { Role } from './roles.ts';

/** Who is asking, as a verified session states it. */
export interface SessionUser {
  readonly roles: readonly string[];
  readonly sub: string;
  readonly teams: readonly string[];
}

/** What the checks need to know about an indicator. */
export interface IndicatorAccess {
  readonly teamId: string | null;
  /** The IMRG reviewers assigned to it. */
  readonly reviewerIds: readonly string[];
}

/** The indicators a list shows: every one, or those of the given teams. */
export type IndicatorListScope =
  | { readonly all: true }
  | { readonly all: false; readonly teamIds: readonly string[] };

function holds(user: SessionUser, role: Role): boolean {
  return user.roles.includes(role);
}

/** Whether the user may open the indicator list; `canSeeIndicator` decides which ones it shows. */
export function canListIndicators(user: SessionUser): boolean {
  return (['publisher', 'imrg-manager', 'imrg-reviewer', 'admin'] as const).some((role) =>
    holds(user, role),
  );
}

/** The team a new indicator joins: its creator's first, until a publisher can choose one. */
export function teamForNewIndicator(user: SessionUser): string | undefined {
  return holds(user, 'publisher') ? user.teams[0] : undefined;
}

export function canCreateIndicator(user: SessionUser): boolean {
  return teamForNewIndicator(user) !== undefined;
}

export function canEditIndicator(
  user: SessionUser,
  { teamId }: Pick<IndicatorAccess, 'teamId'>,
): boolean {
  return holds(user, 'publisher') && teamId !== null && user.teams.includes(teamId);
}

export function canReviewIndicator(
  user: SessionUser,
  { reviewerIds }: Pick<IndicatorAccess, 'reviewerIds'>,
): boolean {
  return holds(user, 'imrg-reviewer') && reviewerIds.includes(user.sub);
}

export function canSeeIndicator(user: SessionUser, indicator: IndicatorAccess): boolean {
  return (
    holds(user, 'admin') ||
    holds(user, 'imrg-manager') ||
    canEditIndicator(user, indicator) ||
    canReviewIndicator(user, indicator)
  );
}

export function canAssignReviewers(user: SessionUser): boolean {
  return holds(user, 'imrg-manager');
}

/** Whether the user may manage the service's shared content, such as its topics. */
export function canManage(user: SessionUser): boolean {
  return holds(user, 'admin');
}

export function canMoveIndicatorBetweenTeams(user: SessionUser): boolean {
  return holds(user, 'admin');
}

export function canSeeTeamsAndUsers(user: SessionUser): boolean {
  return holds(user, 'admin');
}

/**
 * The indicators `canSeeIndicator` lets the user see, as a list query filters them. Reviewer
 * assignments are not stored yet, so being a reviewer adds no indicators.
 */
export function indicatorListScope(user: SessionUser): IndicatorListScope {
  if (holds(user, 'admin') || holds(user, 'imrg-manager')) return { all: true };

  return { all: false, teamIds: holds(user, 'publisher') ? user.teams : [] };
}
