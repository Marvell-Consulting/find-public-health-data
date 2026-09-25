import { GridColumn, GridRow, InsetText, TaskList } from '@fphd/ui';

import { indicatorSectionPath } from '../publish-paths.ts';
import { IndicatorHeading } from '../status-tag/indicator-heading.tsx';
import { StatusTag } from '../status-tag/status-tag.tsx';
import type {
  IndicatorTaskKey,
  IndicatorTaskList,
  IndicatorTaskStatus,
  IndicatorTaskStatuses,
} from './loader.ts';

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

function sectionPath(section: IndicatorTaskKey) {
  return (id: string) => indicatorSectionPath(id, section);
}

/** Every field a publisher completes, grouped as the publishing journey asks for them. */
const TASK_GROUPS: readonly TaskGroup[] = [
  {
    id: 'data',
    title: 'Data',
    tasks: [
      { key: 'data-table', title: 'Data table' },
      { key: 'value-type-and-units', title: 'Value type and units' },
      { key: 'sex-and-ages', title: 'Sex and ages', path: sectionPath('sex-and-ages') },
      { key: 'period-type', title: 'Period type' },
      { key: 'polarity', title: 'Polarity', path: sectionPath('polarity') },
      { key: 'data-quality', title: 'Data quality' },
    ],
  },
  {
    id: 'metadata',
    title: 'Metadata',
    tasks: [
      { key: 'name', title: 'Name', path: sectionPath('name') },
      {
        key: 'definition-and-rationale',
        title: 'Definition and rationale',
        path: sectionPath('definition-and-rationale'),
      },
      { key: 'numerator', title: 'Numerator' },
      { key: 'denominator', title: 'Denominator' },
      {
        key: 'calculation',
        title: 'How the indicator was calculated',
        path: sectionPath('calculation'),
      },
      {
        key: 'confidence-intervals',
        title: 'Confidence intervals',
        path: sectionPath('confidence-intervals'),
      },
      { key: 'benchmarking', title: 'Benchmarking' },
      {
        key: 'other-notes-and-caveats',
        title: 'Other notes and caveats',
        path: sectionPath('other-notes-and-caveats'),
      },
      { key: 'links', title: 'Links', path: sectionPath('links') },
      { key: 'tagging', title: 'Tagging' },
      { key: 'copyright-and-data-re-use', title: 'Copyright and data re-use' },
    ],
  },
  {
    id: 'publishing',
    title: 'Publishing',
    tasks: [
      {
        key: 'update-frequency',
        title: 'Update frequency',
        path: sectionPath('update-frequency'),
      },
      { key: 'publishing-date', title: 'Publishing date', path: sectionPath('publishing-date') },
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

export function IndicatorTaskListPage({ taskList }: { taskList: IndicatorTaskList }) {
  const { indicator, tasks } = taskList;

  return (
    <GridRow>
      <GridColumn width="two-thirds">
        <IndicatorHeading indicator={indicator} />
        <InsetText>
          You can complete these sections in any order. If you exit at any point, any selections or
          text you've added will be saved.
        </InsetText>
        {TASK_GROUPS.map((group) => (
          <div key={group.id}>
            <h2 className="govuk-heading-m">{group.title}</h2>
            <TaskList
              idPrefix={group.id}
              items={group.tasks.map(({ key, path, title }) => ({
                id: key,
                title,
                href: path?.(indicator.id),
                status: <StatusTag type="task" status={statusOf(tasks, key)} />,
              }))}
            />
          </div>
        ))}
      </GridColumn>
    </GridRow>
  );
}
