import type { IndicatorTaskKey } from '@fphd/internal-api-features/contract';

/** The publishing journey, which is separate from the dashboard the indicators are listed on. */
export const PUBLISH_PATH = '/publish';

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
