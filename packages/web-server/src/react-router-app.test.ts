import { createJwtSessionService } from '@fphd/auth/jwt-session';
import type { Request, Response } from 'express';
import type { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  getLoadContext: undefined as
    | ((request: Request, response: Response) => RouterContextProvider)
    | undefined,
}));

vi.mock('@react-router/express', () => ({
  createRequestHandler: (options: {
    getLoadContext: (request: Request, response: Response) => RouterContextProvider;
  }) => {
    captured.getLoadContext = options.getLoadContext;
    return (_request: Request, _response: Response, next: () => void) => next();
  },
}));

import { nonceContext } from './nonce-context.js';
import { createReactRouterApp } from './react-router-app.js';

const session = createJwtSessionService({
  audience: 'fphd-public',
  cookieName: 'fphd-public-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});

function loadContext(nonce: string) {
  const response = { locals: { nonce } } as unknown as Response;
  const context = captured.getLoadContext?.({} as Request, response);

  if (context === undefined) {
    throw new Error('Expected getLoadContext to have been captured');
  }

  return context;
}

describe('createReactRouterApp', () => {
  it('does not advertise Express via x-powered-by on document responses', () => {
    const app = createReactRouterApp(
      () => {
        throw new Error('build should not load while asserting app settings');
      },
      { session },
    );

    expect(app.disabled('x-powered-by')).toBe(true);
  });

  it('sets the nonce on the load context when no extendContext is given', () => {
    createReactRouterApp(
      () => {
        throw new Error('build should not load while asserting context wiring');
      },
      { session },
    );

    expect(loadContext('test-nonce').get(nonceContext)).toBe('test-nonce');
  });

  it('runs extendContext after the nonce has been set, so it can add further values', () => {
    createReactRouterApp(
      () => {
        throw new Error('build should not load while asserting context wiring');
      },
      {
        session,
        extendContext: (context) => {
          context.set(nonceContext, `${context.get(nonceContext)}-extended`);
        },
      },
    );

    expect(loadContext('test-nonce').get(nonceContext)).toBe('test-nonce-extended');
  });
});
