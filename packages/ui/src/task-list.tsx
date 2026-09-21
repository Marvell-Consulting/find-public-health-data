import A from '@not-govuk/link';
import type { ReactNode } from 'react';

export interface TaskListItem {
  /** Identifies the row and keys its status element; never shown. */
  id: string;
  title: string;
  /** Where the task is completed or edited; a task with no form yet has no link. */
  href?: string | undefined;
  status: ReactNode;
}

interface TaskListProps {
  /** Prefixes the generated status ids, so several lists on one page stay distinct. */
  idPrefix?: string | undefined;
  items: readonly TaskListItem[];
}

/**
 * The GOV.UK task list. It is not a @not-govuk component — there is none at the release the
 * rest of the components come from — so the markup follows govuk-frontend's own template,
 * including the aria-describedby that reads a task's status out with its link.
 */
export function TaskList({ idPrefix = 'task-list', items }: TaskListProps) {
  return (
    <ul className="govuk-task-list">
      {items.map(({ href, id, status, title }) => {
        const statusId = `${idPrefix}-${id}-status`;

        return (
          <li
            className={`govuk-task-list__item${href === undefined ? '' : ' govuk-task-list__item--with-link'}`}
            key={id}
          >
            <div className="govuk-task-list__name-and-hint">
              {href === undefined ? (
                <div>{title}</div>
              ) : (
                <A
                  aria-describedby={statusId}
                  className="govuk-link govuk-task-list__link"
                  href={href}
                >
                  {title}
                </A>
              )}
            </div>
            <div className="govuk-task-list__status" id={statusId}>
              {status}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
