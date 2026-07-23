import { randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import { InvalidJwtSessionError } from './session-errors.js';

export interface JwtSessionClaims {
  readonly aud: string;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly jti: string;
  readonly roles: readonly string[];
  readonly sub: string;
}

export interface IssueJwtSessionOptions {
  expiresInSeconds: number;
  roles: readonly string[];
  subject: string;
}

export interface JwtSessionServiceOptions {
  audience: string;
  clock?: () => Date;
  cookieName: string;
  issuer: string;
  secret: string | undefined;
  secure: boolean;
}

export interface JwtSessionService {
  clearCookieHeader(): string;
  createCookieHeader(token: string, maxAgeSeconds: number): string;
  issueToken(options: IssueJwtSessionOptions): Promise<string>;
  readToken(cookieHeader: string | null): string | undefined;
  verifyToken(token: string): Promise<JwtSessionClaims>;
}

export type JwtSessionVerifier = Pick<
  JwtSessionService,
  'clearCookieHeader' | 'readToken' | 'verifyToken'
>;

function requireNonEmpty(value: string, name: string): string {
  if (value.trim() === '') throw new Error(`${name} is required`);
  return value;
}

function validateCookieName(cookieName: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(cookieName)) {
    throw new Error('JWT session cookie name is invalid');
  }
  return cookieName;
}

function parseCookie(cookieHeader: string | null, cookieName: string): string | undefined {
  if (cookieHeader === null) return undefined;

  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;

    const name = entry.slice(0, separator).trim();
    if (name === cookieName) return entry.slice(separator + 1).trim();
  }

  return undefined;
}

function serializeCookie(
  cookieName: string,
  value: string,
  secure: boolean,
  attributes: readonly string[],
): string {
  return [
    `${cookieName}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    ...attributes,
  ].join('; ');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function createJwtSessionService({
  audience,
  clock = () => new Date(),
  cookieName,
  issuer,
  secret,
  secure,
}: JwtSessionServiceOptions): JwtSessionService {
  const validatedAudience = requireNonEmpty(audience, 'JWT session audience');
  const validatedCookieName = validateCookieName(cookieName);
  const validatedIssuer = requireNonEmpty(issuer, 'JWT session issuer');

  if (secret === undefined || secret.trim() === '') {
    throw new Error('SESSION_JWT_SECRET is required');
  }

  const key = new TextEncoder().encode(secret);
  if (key.byteLength < 32) {
    throw new Error('SESSION_JWT_SECRET must be at least 32 bytes');
  }

  return {
    clearCookieHeader() {
      return serializeCookie(validatedCookieName, '', secure, [
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ]);
    },

    createCookieHeader(token, maxAgeSeconds) {
      if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
        throw new Error('JWT session cookie max age must be a positive integer');
      }
      return serializeCookie(validatedCookieName, token, secure, [`Max-Age=${maxAgeSeconds}`]);
    },

    async issueToken({ expiresInSeconds, roles, subject }) {
      if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
        throw new Error('JWT session lifetime must be a positive integer');
      }
      if (!isStringArray(roles) || roles.some((role) => role.trim() === '')) {
        throw new Error('JWT session roles must be non-empty strings');
      }

      const validatedSubject = requireNonEmpty(subject, 'JWT session subject');
      const issuedAt = Math.floor(clock().getTime() / 1_000);

      return new SignJWT({ roles: [...roles] })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(validatedIssuer)
        .setAudience(validatedAudience)
        .setSubject(validatedSubject)
        .setJti(randomUUID())
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + expiresInSeconds)
        .sign(key);
    },

    readToken(cookieHeader) {
      return parseCookie(cookieHeader, validatedCookieName);
    },

    async verifyToken(token) {
      try {
        const { payload, protectedHeader } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          audience: validatedAudience,
          currentDate: clock(),
          issuer: validatedIssuer,
          requiredClaims: ['aud', 'exp', 'iat', 'iss', 'jti', 'sub'],
        });

        if (
          protectedHeader.typ !== 'JWT' ||
          typeof payload.aud !== 'string' ||
          typeof payload.exp !== 'number' ||
          typeof payload.iat !== 'number' ||
          typeof payload.iss !== 'string' ||
          typeof payload.jti !== 'string' ||
          typeof payload.sub !== 'string' ||
          !isStringArray(payload.roles)
        ) {
          throw new InvalidJwtSessionError();
        }

        return Object.freeze({
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
          iss: payload.iss,
          jti: payload.jti,
          roles: Object.freeze([...payload.roles]),
          sub: payload.sub,
        });
      } catch {
        throw new InvalidJwtSessionError();
      }
    },
  };
}

export function createJwtSessionVerifier(service: JwtSessionService): JwtSessionVerifier {
  const { clearCookieHeader, readToken, verifyToken } = service;
  return Object.freeze({ clearCookieHeader, readToken, verifyToken });
}
