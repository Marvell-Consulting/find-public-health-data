import { createHash, timingSafeEqual } from 'node:crypto';

import { parse } from 'basic-auth';
import type { RequestHandler } from 'express';

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

// Digests have a fixed length, so the comparison time does not depend on the input's length.
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function basicAuth({ username, password }: BasicAuthCredentials): RequestHandler {
  const expectedUsername = digest(username);
  const expectedPassword = digest(password);

  return (request, response, next) => {
    const credentials = parse(request.headers.authorization ?? '');
    // Both compared up front, so a wrong username takes as long as a wrong password.
    const usernameMatches = timingSafeEqual(digest(credentials?.name ?? ''), expectedUsername);
    const passwordMatches = timingSafeEqual(digest(credentials?.pass ?? ''), expectedPassword);

    if (credentials !== undefined && usernameMatches && passwordMatches) {
      next();
      return;
    }

    response.setHeader(
      'WWW-Authenticate',
      'Basic realm="Find public health data", charset="UTF-8"',
    );
    response.status(401).type('text').send('Authentication required');
  };
}
