import { fakeUsers } from '@fphd/auth';
import { type Database, schema } from '@fphd/db';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';

import type { ReviewerOption } from './contract.ts';
import type { Transaction } from './indicator-repository-sql.ts';

const {
  appUser,
  indicatorVersion,
  indicatorVersionSubmission,
  indicatorVersionSubmissionReviewer,
} = schema;

type Reader = Database | Transaction;

/** Everyone holding the IMRG reviewer role: the fake users with it, until roles are stored. */
function reviewerRoleHolderIds(): string[] {
  return fakeUsers.filter(({ roles }) => roles.includes('imrg-reviewer')).map(({ id }) => id);
}

/** Who wrote the indicator's first version, whatever has happened to it since. */
async function creatorOf(db: Reader, indicatorId: string): Promise<string | undefined> {
  const [first] = await db
    .select({ createdBy: indicatorVersion.createdBy })
    .from(indicatorVersion)
    .where(eq(indicatorVersion.indicatorId, indicatorId))
    .orderBy(asc(indicatorVersion.createdAt), asc(indicatorVersion.id))
    .limit(1);
  return first?.createdBy;
}

async function latestDraftSubmitterOf(
  db: Reader,
  indicatorId: string,
): Promise<string | undefined> {
  const [latest] = await db
    .select({ submittedBy: indicatorVersionSubmission.submittedBy })
    .from(indicatorVersionSubmission)
    .innerJoin(
      indicatorVersion,
      and(
        eq(indicatorVersion.id, indicatorVersionSubmission.indicatorVersionId),
        eq(indicatorVersion.status, 'draft'),
      ),
    )
    .where(eq(indicatorVersionSubmission.indicatorId, indicatorId))
    .orderBy(desc(indicatorVersionSubmission.number))
    .limit(1);
  return latest?.submittedBy;
}

/**
 * The reviewers who may review the indicator: everyone with the role but its creator and
 * whoever submitted its draft's latest submission.
 */
export async function findEligibleReviewerIds(db: Reader, indicatorId: string): Promise<string[]> {
  const excluded = [
    await creatorOf(db, indicatorId),
    await latestDraftSubmitterOf(db, indicatorId),
  ];
  return reviewerRoleHolderIds().filter((id) => !excluded.includes(id));
}

/** The reviewers assigned to the submission. */
export async function assignedReviewerIds(db: Reader, submissionId: string): Promise<string[]> {
  const rows = await db
    .select({ reviewerId: indicatorVersionSubmissionReviewer.reviewerId })
    .from(indicatorVersionSubmissionReviewer)
    .where(eq(indicatorVersionSubmissionReviewer.submissionId, submissionId));
  return rows.map(({ reviewerId }) => reviewerId);
}

/**
 * The reviewers who may review the indicator, by name, each with the number of submissions in
 * review they are assigned to: one per indicator, as only a draft's latest submission is open.
 */
export async function listReviewerOptions(
  db: Database,
  indicatorId: string,
): Promise<ReviewerOption[]> {
  const ids = await findEligibleReviewerIds(db, indicatorId);
  if (ids.length === 0) return [];

  return db
    .select({
      id: appUser.id,
      name: appUser.displayName,
      assignedIndicatorCount: count(indicatorVersionSubmission.id),
    })
    .from(appUser)
    .leftJoin(
      indicatorVersionSubmissionReviewer,
      eq(indicatorVersionSubmissionReviewer.reviewerId, appUser.id),
    )
    .leftJoin(
      indicatorVersionSubmission,
      and(
        eq(indicatorVersionSubmission.id, indicatorVersionSubmissionReviewer.submissionId),
        eq(indicatorVersionSubmission.status, 'in_review'),
      ),
    )
    .where(inArray(appUser.id, ids))
    .groupBy(appUser.id)
    .orderBy(asc(appUser.displayName), asc(appUser.id));
}
