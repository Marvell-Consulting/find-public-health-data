import { randomBytes } from 'node:crypto';

import type { RequestHandler } from 'express';

interface SecurityHeaderOptions {
  development: boolean;
  nonce: string;
}

function contentSecurityPolicy({ development, nonce }: SecurityHeaderOptions): string {
  // Vite's middleware-mode dev server injects styles as inline <style> during HMR and talks to
  // the client over a websocket; neither exists in the production build, so relax only there.
  const styleSrc = development ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const connectSrc = development ? "connect-src 'self' ws:" : "connect-src 'self'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    styleSrc,
    "img-src 'self' data:",
    "font-src 'self'",
    connectSrc,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

/**
 * Only the headers that need an HTML document to mean anything. The ones that apply to every
 * response from any host — HSTS, `nosniff`, `Referrer-Policy` — are `@fphd/express`'s, so the
 * APIs get them too; neither of these two would do anything on a JSON response.
 */
export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    // frame-ancestors covers modern browsers; X-Frame-Options covers the ones that ignore it.
    'X-Frame-Options': 'DENY',
  };
}

export function securityHeaders({ development }: { development: boolean }): RequestHandler {
  return (_request, response, next) => {
    const nonce = randomBytes(16).toString('base64');
    response.locals.nonce = nonce;

    for (const [header, value] of Object.entries(buildSecurityHeaders({ development, nonce }))) {
      response.setHeader(header, value);
    }

    next();
  };
}
