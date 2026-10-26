import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { MORTALITY_PATH } from '../support/indicator-page.ts';

test('the retired multi-indicator address leads to search', async ({ page }, testInfo) => {
  await page.goto('/indicators');
  await expect(page).toHaveURL('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});

test('old indicator links lead to the single-indicator route', async ({ page }) => {
  const response = await page.request.get(
    '/indicators/under-75-mortality-rate-from-all-causes?as=E08000003',
    {
      maxRedirects: 0,
    },
  );
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(`${MORTALITY_PATH}?as=E08000003`);
});
