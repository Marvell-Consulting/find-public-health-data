import type { IndicatorTaskKey } from '@fphd/internal-api-features/contract';

/** The publishing journey, which is separate from the dashboard the indicators are listed on. */
const PUBLISH_PATH = '/publish';

export const NEW_INDICATOR_PATH = `${PUBLISH_PATH}/indicators/new`;

function indicatorPublishPath(id: string, page: string): string {
  return `${PUBLISH_PATH}/indicators/${encodeURIComponent(id)}/${page}`;
}

export function indicatorTaskListPath(id: string): string {
  return indicatorPublishPath(id, 'task-list');
}

/** Each section of a draft has a page, named by its task key. */
export function indicatorSectionPath(id: string, section: IndicatorTaskKey): string {
  return indicatorPublishPath(id, section);
}

/** The data table task's own page, where the file is uploaded. */
export function indicatorDataTablePath(id: string): string {
  return indicatorPublishPath(id, 'data-table');
}

/** Where a refused data table's problems are listed until a later upload loads. */
export function indicatorDataTableProblemsPath(id: string): string {
  return indicatorPublishPath(id, 'data-table/problems');
}

/** Where a loaded data table is played back for the publisher to confirm. */
export function indicatorDataTableCheckPath(
  id: string,
  { page = 1, rowsPerPage = 10 }: { page?: number; rowsPerPage?: number } = {},
): string {
  const query = new URLSearchParams({
    ...(page === 1 ? {} : { page: String(page) }),
    ...(rowsPerPage === 10 ? {} : { rowsPerPage: String(rowsPerPage) }),
  }).toString();
  return `${indicatorPublishPath(id, 'data-table/check')}${query === '' ? '' : `?${query}`}`;
}
