import { describe, expect, it } from 'vitest';

import { buildSecurityHeaders } from './security-headers.js';

function cspDirectives(headers: Record<string, string>): string[] {
  return headers['Content-Security-Policy']?.split('; ') ?? [];
}

describe('buildSecurityHeaders', () => {
  const prod = buildSecurityHeaders({ development: false, nonce: 'test-nonce' });
  const dev = buildSecurityHeaders({ development: true, nonce: 'test-nonce' });

  it('sets the full set of security headers', () => {
    expect(prod).toMatchObject({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    expect(prod['Content-Security-Policy']).toBeDefined();
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
