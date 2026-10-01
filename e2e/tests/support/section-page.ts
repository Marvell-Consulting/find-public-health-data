import { expect, type Page } from '@playwright/test';

import { createDraft, uniqueIndicatorName } from './create-indicator.ts';
import { MORTALITY_ID } from './indicator-page.ts';

/** A page of a draft's task list: its path segment and the name of its task row. */
export type Section = { key: string; taskName: string };

// The header and footer have lists of their own, so the task row is read inside the page.
export function taskRow(page: Page, taskName: string) {
  return page.getByRole('main').getByRole('listitem').filter({ hasText: taskName }).first();
}

/**
 * Opens a new draft's section page by its address; returns the draft's task list path. Each
 * section spec reaches its page from the task list once, in a test of its own.
 */
export async function openSectionPage(page: Page, { key }: Section): Promise<string> {
  const id = await createDraft(page, uniqueIndicatorName(key));

  await page.goto(`/publish/indicators/${id}/${key}`);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  return `/publish/indicators/${id}/task-list`;
}

export async function expectBackToTaskList(page: Page, taskListPath: string) {
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(taskListPath);
}

/** Expects not-found for the page of a malformed id, an unknown id and a draftless indicator. */
export async function expectNotFoundWithoutDraft(page: Page, key: string) {
  for (const path of [
    `/publish/indicators/108/${key}`,
    `/publish/indicators/00000000-0000-7000-8000-000000000000/${key}`,
    // The seeded indicator is published, so it has no draft.
    `/publish/indicators/${MORTALITY_ID}/${key}`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
}
