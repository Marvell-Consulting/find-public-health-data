export const TOPICS_ADMIN_PATH = '/manage/topics';

export const NEW_TOPIC_PATH = `${TOPICS_ADMIN_PATH}/new`;

export function editTopicPath(id: string): string {
  return `${TOPICS_ADMIN_PATH}/${encodeURIComponent(id)}`;
}

export function deleteTopicPath(id: string): string {
  return `${editTopicPath(id)}/delete`;
}
