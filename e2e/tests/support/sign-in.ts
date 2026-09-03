import { expect, type Page } from '@playwright/test';

/** Submits the fake sign-in form already on screen and waits for the redirect away from it. */
export async function submitSignIn(page: Page, name: string) {
  await page.getByRole('radio', { name }).check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname !== '/sign-in');
}

/** Signs in from the sign-in page and lands on the home page. */
export async function signInAs(page: Page, name: string) {
  await page.goto('/sign-in');
  await submitSignIn(page, name);
  await expect(page).toHaveURL('/');
}
