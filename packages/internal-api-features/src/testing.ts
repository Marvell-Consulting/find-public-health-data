import { Writable } from 'node:stream';

import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { withThrowingDefaults } from '@fphd/db/testing';
import type { Express, Router } from 'express';
import { type Logger, pino } from 'pino';

import { toFieldErrors } from './contract.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type { InternalRepositories } from './repositories.ts';

/** Per-method stubs; anything unstubbed throws, as with `createFakeRepositories` in `@fphd/db`. */
export type FakeInternalRepositoryOverrides = {
  [K in keyof InternalRepositories]?: Partial<InternalRepositories[K]>;
};

export function createFakeInternalRepositories(
  overrides: FakeInternalRepositoryOverrides = {},
): InternalRepositories {
  return {
    ciMethods: withThrowingDefaults('ciMethods', overrides.ciMethods),
    indicators: withThrowingDefaults('indicators', overrides.indicators),
    topics: withThrowingDefaults('topics', overrides.topics),
  };
}

const testSession = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-08-04T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});

export const testSessionVerifier = createJwtSessionVerifier(testSession);

/** A session cookie for `test-user` holding the given roles. */
export async function testSessionCookie(roles: readonly string[]): Promise<string> {
  const token = await testSession.issueToken({
    expiresInSeconds: 900,
    roles,
    subject: 'test-user',
  });
  return testSession.createCookieHeader(token, 900);
}

/** An internal API app serving one router, logging nowhere unless given a logger. */
export function createRouterTestApp(
  router: Router,
  logger: Logger = pino({ level: 'silent' }),
): Express {
  const app = createApiApp({ logger, serviceName: 'internal-api' });

  app.use(router);

  return app;
}

/** A logger whose lines are collected as parsed JSON. */
export function createCapturingLogger(): { logger: Logger; lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)));
      callback();
    },
  });

  return { logger: pino({ name: 'internal-api' }, destination), lines };
}

/** The lines a handler wrote, without the request line pino-http adds once the response ends. */
export async function handlerLogLines(
  lines: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  await new Promise((resolve) => setImmediate(resolve));
  return lines.filter((line) => line.res === undefined);
}

/** The field errors a section's schema gives a submission, or undefined when it accepts it. */
export function sectionFieldErrors<Field extends string, Values, Input>(
  section: IndicatorSection<Field, Values, Input>,
  body: unknown,
): Partial<Record<Field, string>> | undefined {
  const submission = section.schema.safeParse(body);
  return submission.success ? undefined : toFieldErrors(submission.error, section.fields.options);
}
