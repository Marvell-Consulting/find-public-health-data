import {
  INDICATOR_SUBMISSION_STATUSES,
  type IndicatorSubmissionStatus,
} from '@fphd/utils/indicator-submission-status';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { literals, uuidPrimaryKey } from './helpers.ts';
import { indicatorVersion } from './indicator.ts';
import { appUser } from './user.ts';

/** The statuses that end a submission, each recording who ended it and when. */
const ENDED_STATUSES = ['withdrawn'] as const satisfies readonly IndicatorSubmissionStatus[];

/**
 * One round of review of a version: inserted when the publisher submits it and updated as the
 * review goes on. The audit log keeps each change.
 */
export const indicatorVersionSubmission = pgTable(
  'indicator_version_submission',
  {
    id: uuidPrimaryKey(),
    indicatorVersionId: uuid().notNull(),
    indicatorId: uuid().notNull(),
    // 1 for a version's first submission, one more for each resubmission.
    number: integer().notNull(),
    status: text({ enum: INDICATOR_SUBMISSION_STATUSES }).notNull(),
    submittedBy: uuid().notNull(),
    // Insert time, not transaction start, so submissions sort in commit order.
    submittedAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    endedBy: uuid(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // Pairing the version with indicator_id keeps a submission on a version of its own indicator.
    foreignKey({
      name: 'indicator_version_submission_version_fk',
      columns: [t.indicatorVersionId, t.indicatorId],
      foreignColumns: [indicatorVersion.id, indicatorVersion.indicatorId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'indicator_version_submission_submitted_by_fk',
      columns: [t.submittedBy],
      foreignColumns: [appUser.id],
    }),
    foreignKey({
      name: 'indicator_version_submission_ended_by_fk',
      columns: [t.endedBy],
      foreignColumns: [appUser.id],
    }),
    check(
      'indicator_version_submission_status_check',
      sql`${t.status} IN (${literals(INDICATOR_SUBMISSION_STATUSES)})`,
    ),
    check('indicator_version_submission_number_check', sql`${t.number} > 0`),
    check(
      'indicator_version_submission_ended_check',
      sql`(${t.status} IN (${literals(ENDED_STATUSES)})) = (${t.endedBy} IS NOT NULL) AND (${t.endedBy} IS NULL) = (${t.endedAt} IS NULL)`,
    ),
    // Also serves the latest-submission lookup and the foreign key.
    uniqueIndex('idx_indicator_version_submission_indicator_version_id_number').on(
      t.indicatorVersionId,
      t.number,
    ),
    index('idx_indicator_version_submission_indicator_id_submitted_at').on(
      t.indicatorId,
      t.submittedAt,
    ),
  ],
);

/**
 * The reviewers assigned to a submission. Changing them deletes the rows of those removed; the
 * audit log keeps who was assigned when.
 */
export const indicatorVersionSubmissionReviewer = pgTable(
  'indicator_version_submission_reviewer',
  {
    submissionId: uuid().notNull(),
    reviewerId: uuid().notNull(),
    assignedBy: uuid().notNull(),
    assignedAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [
    primaryKey({
      name: 'indicator_version_submission_reviewer_pk',
      columns: [t.submissionId, t.reviewerId],
    }),
    foreignKey({
      name: 'indicator_version_submission_reviewer_submission_fk',
      columns: [t.submissionId],
      foreignColumns: [indicatorVersionSubmission.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'indicator_version_submission_reviewer_reviewer_fk',
      columns: [t.reviewerId],
      foreignColumns: [appUser.id],
    }),
    foreignKey({
      name: 'indicator_version_submission_reviewer_assigned_by_fk',
      columns: [t.assignedBy],
      foreignColumns: [appUser.id],
    }),
    index('idx_indicator_version_submission_reviewer_reviewer_id').on(t.reviewerId),
  ],
);
