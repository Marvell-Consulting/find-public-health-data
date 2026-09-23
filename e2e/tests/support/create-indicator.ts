import { expect, type Page, test } from '@playwright/test';

/**
 * A name no other spec, worker or run uses, so the shared seeded database is only ever added to
 * and each test can find the indicator it made itself.
 */
export function uniqueIndicatorName(label: string) {
  return `E2E ${label} ${test.info().parallelIndex} ${Date.now().toString(36)}`;
}

/** Names a new indicator, waits for its task list as Continue leads to, and returns its id. */
export async function createIndicator(page: Page, name: string): Promise<string> {
  await page.goto('/publish/indicators/new');
  await page.getByLabel('What is the name of the indicator?').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/task-list$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  const [, id] = new URL(page.url()).pathname.match(/([0-9a-f-]{36})/) ?? [];
  if (id === undefined) throw new Error(`no indicator id in ${page.url()}`);
  return id;
}
