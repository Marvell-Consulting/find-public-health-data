import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

// Every write here creates its own topic under a slug no other spec or run can hold, so the
// shared seeded database is only ever added to and the seeded topics stay as other specs expect.
function uniqueSlug() {
  return `e2e-${test.info().parallelIndex}-${Date.now().toString(36)}`;
}

async function createTopic(page: Page, values: { title: string; slug: string }) {
  await page.goto('/manage/topics/new');
  await page.getByLabel('Topic name').fill(values.title);
  await page.getByLabel('Slug').fill(values.slug);
  await page.getByLabel('Description').fill(`About ${values.title}.`);
  await page.getByRole('button', { name: 'Create topic' }).click();
  await expect(page).toHaveURL(/\/manage\/topics\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Topic created')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test.describe('the topic list', () => {
  test('lists topics for a publisher', async ({ page }) => {
    await page.goto('/manage/topics');
    await expect(page.getByRole('heading', { level: 1, name: 'Manage topics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a topic' })).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await page.goto('/manage/topics');
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('adding a topic', () => {
  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await page.goto('/manage/topics/new');
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
    page,
  }, testInfo) => {
    await page.goto('/manage/topics/new');
    await page.getByRole('button', { name: 'Create topic' }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a topic name');
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('creates the topic and lands on its edit page', async ({ page }) => {
    const slug = uniqueSlug();

    await createTopic(page, { title: `Created ${slug}`, slug });

    await expect(page.getByRole('heading', { level: 1, name: 'Edit topic' })).toBeVisible();
    await expect(page.getByLabel('Slug')).toHaveValue(slug);
  });
});

test.describe('editing a topic', () => {
  test('saves a change and reports it', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Edit ${slug}`, slug });

    await page.getByLabel('Topic name').fill(`Edited ${slug}`);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Topic updated')).toBeVisible();
    await expect(page.getByLabel('Topic name')).toHaveValue(`Edited ${slug}`);
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Scan ${slug}`, slug });
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('deleting a topic', () => {
  test('asks for confirmation, then removes the topic from the list', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Delete ${slug}`, slug });

    await page.getByRole('link', { name: 'Delete topic' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Delete topic' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete topic' }).click();

    await expect(page).toHaveURL('/manage/topics');
    await expect(page.getByText('Topic deleted')).toBeVisible();
    await expect(page.getByRole('link', { name: `Delete ${slug}` })).toHaveCount(0);
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Scan delete ${slug}`, slug });
    await page.getByRole('link', { name: 'Delete topic' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Delete topic' })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });
});
