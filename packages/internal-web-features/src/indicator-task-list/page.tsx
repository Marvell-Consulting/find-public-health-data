import { BackLink, GridColumn, GridRow, Tag, TaskList } from '@fphd/ui';
import type { ReactNode } from 'react';

import { indicatorNamePath } from '../indicator-name/paths.ts';
import { indicatorOverviewPath } from '../indicator-overview/paths.ts';
import type { IndicatorTaskList, IndicatorTaskStatus, IndicatorTaskStatuses } from './loader.ts';

interface TaskRow {
  /** Matches the API's task key where the API judges the task. */
  key: string;
  title: string;
  /** The page that completes the task; a task with no form yet has none. */
  path?: (id: string) => string;
}

interface TaskGroup {
  id: string;
  title: string;
  tasks: readonly TaskRow[];
}

/** Every field a publisher completes, grouped as the publishing journey asks for them. */
const TASK_GROUPS: readonly TaskGroup[] = [
  {
    id: 'data',
    title: 'Data',
    tasks: [
      { key: 'data-table', title: 'Data table' },
      { key: 'value-type-and-units', title: 'Value type and units' },
      { key: 'sex-and-ages', title: 'Sex and ages' },
      { key: 'period-type', title: 'Period type' },
      { key: 'polarity', title: 'Polarity' },
      { key: 'data-quality', title: 'Data quality' },
    ],
  },
  {
    id: 'metadata',
    title: 'Metadata',
    tasks: [
      { key: 'name', title: 'Name', path: indicatorNamePath },
      { key: 'definition-and-rationale', title: 'Definition and rationale' },
      { key: 'numerator', title: 'Numerator' },
      { key: 'denominator', title: 'Denominator' },
      { key: 'calculation', title: 'How the indicator was calculated' },
      { key: 'confidence-intervals', title: 'Confidence intervals' },
      { key: 'benchmarking', title: 'Benchmarking' },
      { key: 'other-notes-and-caveats', title: 'Other notes and caveats' },
      { key: 'links', title: 'Links' },
      { key: 'tagging', title: 'Tagging' },
      { key: 'copyright-and-data-re-use', title: 'Copyright and data re-use' },
    ],
  },
  {
    id: 'publishing',
    title: 'Publishing',
    tasks: [
      { key: 'update-frequency', title: 'Update frequency' },
      { key: 'publishing-date', title: 'Publishing date' },
    ],
  },
  {
    id: 'reviewer-notes',
    title: 'Notes for reviewers (for internal use only)',
    tasks: [
      { key: 'variance-and-quality', title: 'Variance and quality' },
      { key: 'justifications', title: 'Justifications' },
      { key: 'other-comments', title: 'Other comments' },
    ],
  },
];

/** The catalogue is wider than the tasks the API judges; the rest are yet to be started. */
function statusOf(tasks: IndicatorTaskStatuses, key: string): IndicatorTaskStatus {
  const judged: Record<string, IndicatorTaskStatus | undefined> = tasks;

  return judged[key] ?? 'not_started';
}

// GOV.UK shows a completed task as plain text, and anything still to do as a tag.
function statusLabel(status: IndicatorTaskStatus): ReactNode {
  return status === 'completed' ? 'Completed' : <Tag classModifiers="grey" text="Not started" />;
}

export function IndicatorTaskListPage({ taskList }: { taskList: IndicatorTaskList }) {
  const { indicator, tasks } = taskList;

  return (
    <>
      <BackLink href={indicatorOverviewPath(indicator.id)}>Back to indicator</BackLink>
      <GridRow>
        <GridColumn width="two-thirds">
          <span className="govuk-caption-xl">ID: {indicator.shortId}</span>
          <h1 className="govuk-heading-xl">{indicator.name}</h1>
          {TASK_GROUPS.map((group) => (
            <div key={group.id}>
              <h2 className="govuk-heading-m">{group.title}</h2>
              <TaskList
                idPrefix={group.id}
                items={group.tasks.map(({ key, path, title }) => ({
                  id: key,
                  title,
                  href: path?.(indicator.id),
                  status: statusLabel(statusOf(tasks, key)),
                }))}
              />
            </div>
          ))}
        </GridColumn>
      </GridRow>
    </>
  );
}
