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
    await expect(page.getByRole('link', { name: 'Alcohol', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a topic' })).toBeVisible();
  });

  test('opens a topic for editing', async ({ page }) => {
    await page.goto('/manage/topics');
    await page.getByRole('link', { name: 'Alcohol', exact: true }).click();

    await expect(page).toHaveURL(/\/manage\/topics\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Edit topic' })).toBeVisible();
    await expect(page.getByLabel('Slug')).toHaveValue('alcohol');
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

  test('rejects an empty submission, naming every field', async ({ page }) => {
    await page.goto('/manage/topics/new');
    await page.getByRole('button', { name: 'Create topic' }).click();

    await expect(page).toHaveURL('/manage/topics/new');
    const summary = page.getByRole('alert');
    await expect(summary.getByRole('link')).toHaveText([
      'Enter a topic name',
      'Enter a slug',
      'Enter a description',
    ]);

    await summary.getByRole('link', { name: 'Enter a slug' }).click();
    await expect(page.getByLabel('Slug')).toBeFocused();
  });

  test('rejects a malformed slug and keeps what was typed', async ({ page }) => {
    await page.goto('/manage/topics/new');
    await page.getByLabel('Topic name').fill('Bad slug');
    await page.getByLabel('Slug').fill('Not A Slug');
    await page.getByLabel('Description').fill('A topic whose slug has spaces.');
    await page.getByRole('button', { name: 'Create topic' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Slug must be lowercase letters or numbers, separated by hyphens',
    );
    await expect(page.getByLabel('Topic name')).toHaveValue('Bad slug');
    await expect(page.getByLabel('Slug')).toHaveValue('Not A Slug');
    await expect(page.getByLabel('Description')).toHaveValue('A topic whose slug has spaces.');
  });

  test('rejects a slug another topic already uses', async ({ page }) => {
    await page.goto('/manage/topics/new');
    await page.getByLabel('Topic name').fill('Another alcohol');
    await page.getByLabel('Slug').fill('alcohol');
    await page.getByLabel('Description').fill('Duplicates the seeded topic.');
    await page.getByRole('button', { name: 'Create topic' }).click();

    await expect(page).toHaveURL('/manage/topics/new');
    await expect(page.getByRole('alert')).toContainText('This slug is already used');
    await expect(page.getByLabel('Slug')).toHaveValue('alcohol');
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

  test('shows the confirmation once', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Once ${slug}`, slug });

    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: 'Edit topic' })).toBeVisible();
    await expect(page.getByText('Topic created')).toHaveCount(0);
  });

  test('lists the new topic and publishes it', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Listed ${slug}`, slug });

    await page.getByRole('link', { name: 'Return to topic list' }).click();
    await expect(page).toHaveURL('/manage/topics');
    await expect(page.getByRole('link', { name: `Listed ${slug}` })).toBeVisible();

    await page.goto(`/topics/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: `Listed ${slug}` })).toBeVisible();
    await expect(page.getByText(`About Listed ${slug}.`)).toBeVisible();
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

  test('reports a save that changes nothing', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Same ${slug}`, slug });

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('No changes were made')).toBeVisible();
  });

  test('changes the slug and moves the public page with it', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Moved ${slug}`, slug });
    const editUrl = page.url();

    await page.getByLabel('Slug').fill(`${slug}-moved`);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(editUrl);
    await expect(page.getByText('Topic updated')).toBeVisible();
    await expect(page.getByLabel('Slug')).toHaveValue(`${slug}-moved`);

    await page.goto(`/topics/${slug}-moved`);
    await expect(page.getByRole('heading', { level: 1, name: `Moved ${slug}` })).toBeVisible();
    const response = await page.goto(`/topics/${slug}`);
    expect(response?.status()).toBe(404);
  });

  test('rejects a slug another topic already uses', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Clash ${slug}`, slug });

    await page.getByLabel('Slug').fill('alcohol');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toContainText('This slug is already used');
    await expect(page.getByLabel('Slug')).toHaveValue('alcohol');
  });

  test('answers a topic that does not exist with the not-found page', async ({ page }) => {
    for (const path of [
      '/manage/topics/not-an-id',
      '/manage/topics/00000000-0000-7000-8000-000000000000',
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    }
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
    await expect(page.getByText(`Are you sure you want to delete Delete ${slug}?`)).toBeVisible();
    await page.getByRole('button', { name: 'Delete topic' }).click();

    await expect(page).toHaveURL('/manage/topics');
    await expect(page.getByText('Topic deleted')).toBeVisible();
    await expect(page.getByRole('link', { name: `Delete ${slug}` })).toHaveCount(0);

    const response = await page.goto(`/topics/${slug}`);
    expect(response?.status()).toBe(404);
  });

  test('can be cancelled', async ({ page }) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Keep ${slug}`, slug });
    const editUrl = page.url();

    await page.getByRole('link', { name: 'Delete topic' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Delete topic' })).toBeVisible();
    await page.getByRole('link', { name: 'Cancel' }).click();

    await expect(page).toHaveURL(editUrl);
    await expect(page.getByLabel('Topic name')).toHaveValue(`Keep ${slug}`);
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    const slug = uniqueSlug();
    await createTopic(page, { title: `Scan delete ${slug}`, slug });
    await page.getByRole('link', { name: 'Delete topic' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Delete topic' })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });
});
