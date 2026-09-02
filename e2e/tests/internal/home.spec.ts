import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('serves the home page to a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Find public health data' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
