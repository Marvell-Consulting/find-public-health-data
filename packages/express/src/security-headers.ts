import type { RequestHandler } from 'express';

const UNIVERSAL_SECURITY_HEADERS: Record<string, string> = {
  // Inert over plain HTTP, so it is sent unconditionally; TLS terminates at the platform edge.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function universalSecurityHeaders(): RequestHandler {
  return (_request, response, next) => {
    for (const [header, value] of Object.entries(UNIVERSAL_SECURITY_HEADERS)) {
      response.setHeader(header, value);
    }

    next();
  };
}
