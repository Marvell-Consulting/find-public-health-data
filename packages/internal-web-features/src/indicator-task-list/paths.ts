import { PUBLISH_PATH } from '../indicator-name/paths.ts';

export function indicatorTaskListPath(id: string): string {
  return `${PUBLISH_PATH}/indicators/${encodeURIComponent(id)}/task-list`;
}
