import { describe, expect, it } from 'vitest';

import { buildSecurityHeaders } from './security-headers.js';

function cspDirectives(headers: Record<string, string>): string[] {
  return headers['Content-Security-Policy']?.split('; ') ?? [];
}

describe('buildSecurityHeaders', () => {
  const prod = buildSecurityHeaders({ development: false, nonce: 'test-nonce' });
  const dev = buildSecurityHeaders({ development: true, nonce: 'test-nonce' });

  it('sets the headers that need a document to mean anything, and only those', () => {
    expect(prod['X-Frame-Options']).toBe('DENY');
    expect(prod['Content-Security-Policy']).toBeDefined();
  });

  // The universal three come from `@fphd/express`, so that every app sends them rather than
  // only the two that render HTML. Duplicating them here would let the base app drop them
  // without a test noticing.
  it('leaves the headers every app sends to the shared base', () => {
    expect(prod['Strict-Transport-Security']).toBeUndefined();
    expect(prod['X-Content-Type-Options']).toBeUndefined();
    expect(prod['Referrer-Policy']).toBeUndefined();
  });

  it('carries the request nonce in script-src', () => {
    expect(cspDirectives(prod)).toContain("script-src 'self' 'nonce-test-nonce'");
  });

  it('locks the production policy down to self and denies framing', () => {
    const directives = cspDirectives(prod);
    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("style-src 'self'");
    expect(directives).toContain("img-src 'self' data:");
    expect(directives).toContain("connect-src 'self'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(directives).toContain("object-src 'none'");
  });

  it('does not weaken the production policy for Vite', () => {
    expect(prod['Content-Security-Policy']).not.toContain("'unsafe-inline'");
    expect(prod['Content-Security-Policy']).not.toContain('ws:');
  });

  it('relaxes only style-src and connect-src in development for Vite HMR', () => {
    const directives = cspDirectives(dev);
    expect(directives).toContain("style-src 'self' 'unsafe-inline'");
    expect(directives).toContain("connect-src 'self' ws:");
    expect(directives).toContain("script-src 'self' 'nonce-test-nonce'");
  });
});
