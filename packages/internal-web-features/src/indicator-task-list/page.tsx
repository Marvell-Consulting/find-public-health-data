import { GridColumn, GridRow, InsetText, TaskList } from '@fphd/ui';

import {
  indicatorDataTableCheckPath,
  indicatorDataTablePath,
  indicatorSectionPath,
} from '../publish-paths.ts';
import { IndicatorHeading } from '../status-tag/indicator-heading.tsx';
import { StatusTag } from '../status-tag/status-tag.tsx';
import type { IndicatorTaskKey, IndicatorTaskList, IndicatorTaskStatus } from './loader.ts';

interface TaskRow {
  key: IndicatorTaskKey;
  title: string;
  /** The page for doing the task, which can depend on the task's status. */
  path: (id: string, status: IndicatorTaskStatus) => string;
}

interface TaskGroup {
  id: string;
  title: string;
  tasks: readonly TaskRow[];
}

function sectionPath(section: IndicatorTaskKey) {
  return (id: string) => indicatorSectionPath(id, section);
}

/** Once a file has been uploaded, the task links to the check page. */
function dataTablePath(id: string, status: IndicatorTaskStatus): string {
  return status === 'not_started' ? indicatorDataTablePath(id) : indicatorDataTableCheckPath(id);
}

/** Every field a publisher completes, grouped as the publishing journey asks for them. */
const TASK_GROUPS: readonly TaskGroup[] = [
  {
    id: 'data',
    title: 'Data',
    tasks: [
      { key: 'data-table', title: 'Data table', path: dataTablePath },
      {
        key: 'value-type-and-units',
        title: 'Value type and units',
        path: sectionPath('value-type-and-units'),
      },
      { key: 'sex-and-ages', title: 'Sex and ages', path: sectionPath('sex-and-ages') },
      { key: 'period-type', title: 'Period type', path: sectionPath('period-type') },
      { key: 'polarity', title: 'Polarity', path: sectionPath('polarity') },
      { key: 'data-quality', title: 'Data quality', path: sectionPath('data-quality') },
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
      { key: 'numerator', title: 'Numerator', path: sectionPath('numerator') },
      { key: 'denominator', title: 'Denominator', path: sectionPath('denominator') },
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
      { key: 'benchmarking', title: 'Benchmarking', path: sectionPath('benchmarking') },
      {
        key: 'other-notes-and-caveats',
        title: 'Other notes and caveats',
        path: sectionPath('other-notes-and-caveats'),
      },
      { key: 'links', title: 'Links', path: sectionPath('links') },
      { key: 'tagging', title: 'Tagging', path: sectionPath('tagging') },
      {
        key: 'copyright-and-data-reuse',
        title: 'Copyright and data re-use',
        path: sectionPath('copyright-and-data-reuse'),
      },
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
      {
        key: 'variance-and-quality',
        title: 'Variance and quality',
        path: sectionPath('variance-and-quality'),
      },
      { key: 'justifications', title: 'Justifications', path: sectionPath('justifications') },
      { key: 'other-comments', title: 'Other comments', path: sectionPath('other-comments') },
    ],
  },
];

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
              id={group.id}
              items={group.tasks.map(({ key, path, title }) => ({
                title,
                href: path(indicator.id, tasks[key]),
                status: <StatusTag type="task" status={tasks[key]} />,
              }))}
            />
          </div>
        ))}
      </GridColumn>
    </GridRow>
  );
}
