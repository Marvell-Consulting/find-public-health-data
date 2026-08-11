import type { RequestHandler } from 'express';

/**
 * The headers that carry no policy decision, so every app sends them and none can be left
 * without them by omission. Split from the web server's by whether a header means anything
 * without an HTML document, not by which app: CSP and `X-Frame-Options` do nothing on a JSON
 * response, while these three apply to any response from any host.
 */
const UNIVERSAL_SECURITY_HEADERS: Record<string, string> = {
  // Inert over plain HTTP; TLS terminates at the platform edge, so always behave as HTTPS.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // An API needs this too: a JSON response that reflects request content and is sniffed as HTML
  // is the whole of the classic attack.
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
