import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

// Every route of the public app in the state the seed data lands it in. A spec that drives a
// page further — a validation error, an area selection — scans that state with the same helper.
const pages = [
  { name: 'home', path: '/' },
  { name: 'topics', path: '/topics' },
  { name: 'topic', path: '/topics/alcohol' },
  { name: 'indicators', path: '/indicators' },
  { name: 'indicator search results', path: '/indicators?searchSubject=smoking' },
  { name: 'indicator', path: '/indicators/108' },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'not found', path: '/no-such-page', status: 404 },
];

for (const { name, path, status = 200 } of pages) {
  test(`${name} page has no WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
    await expectNoAccessibilityViolations(page, testInfo);
  });
}
