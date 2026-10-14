export const ROLES = [
  'public',
  'internal',
  'publisher',
  'imrg-manager',
  'imrg-reviewer',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

/** The four internal roles, each a job in the service; `public` and `internal` only open an app. */
export const JOB_ROLES = ['publisher', 'imrg-manager', 'imrg-reviewer', 'admin'] as const;

export type JobRole = (typeof JOB_ROLES)[number];
