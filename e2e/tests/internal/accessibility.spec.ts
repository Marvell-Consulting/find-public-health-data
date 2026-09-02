import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

const signedOutPages = [
  { name: 'sign-in', path: '/sign-in', status: 200 },
  { name: 'access denied', path: '/access-denied', status: 403 },
];

// Every route behind the internal sign-in, seen as a publisher so the manage page renders.
const signedInPages = [
  { name: 'home', path: '/' },
  { name: 'topics', path: '/topics' },
  { name: 'topic', path: '/topics/alcohol' },
  { name: 'indicators', path: '/indicators' },
  { name: 'indicator', path: '/indicators/108' },
  { name: 'manage', path: '/manage' },
  { name: 'not found', path: '/no-such-page', status: 404 },
];

for (const { name, path, status } of signedOutPages) {
  test(`${name} page has no WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
    await expectNoAccessibilityViolations(page, testInfo);
  });
}

for (const { name, path, status = 200 } of signedInPages) {
  test(`${name} page has no WCAG 2.2 AA violations when signed in`, async ({ page }, testInfo) => {
    await signInAs(page, 'Riley Singh');
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
    await expectNoAccessibilityViolations(page, testInfo);
  });
}
