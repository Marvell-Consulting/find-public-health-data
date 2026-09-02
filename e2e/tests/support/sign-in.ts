import { expect, type Page } from '@playwright/test';

/** Signs in through the fake sign-in page and lands on the home page. */
export async function signInAs(page: Page, name: string) {
  await page.goto('/sign-in');
  await page.getByRole('radio', { name }).check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}
