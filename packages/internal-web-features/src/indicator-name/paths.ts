/** The publishing journey, which is separate from the dashboard the indicators are listed on. */
export const PUBLISH_PATH = '/publish';

export const NEW_INDICATOR_PATH = `${PUBLISH_PATH}/indicators/new`;

export function indicatorNamePath(id: string): string {
  return `${PUBLISH_PATH}/indicators/${encodeURIComponent(id)}/name`;
}
