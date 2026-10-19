export type AppAudience = 'internal' | 'public';

/** The web app sets this cookie, and its server forwards it to the API under the same name. */
export function sessionCookieName(audience: AppAudience): string {
  return `fphd-${audience}-session`;
}
