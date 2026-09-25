import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { expectErrorSummaryReady } from '../support/govuk-frontend.ts';
import {
  expectBackToTaskList,
  expectNotFoundWithoutDraft,
  openSectionPage,
  type Section,
  taskRow,
} from '../support/section-page.ts';
import { signInAs } from '../support/sign-in.ts';

const SECTION: Section = { key: 'publishing-date', taskName: 'Publishing date' };

type DateTime = { day: string; month: string; year: string; hour: string; minute: string };

// Far enough ahead to be accepted whenever the suite runs.
const LATER: DateTime = {
  day: '4',
  month: '1',
  year: String(new Date().getFullYear() + 2),
  hour: '15',
  minute: '05',
};

const UK_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** An instant as the form's parts in UK time. */
function ukDateTime(instant: Date): DateTime {
  const parts = Object.fromEntries(
    UK_PARTS.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    day: parts.day ?? '',
    month: parts.month ?? '',
    year: parts.year ?? '',
    hour: parts.hour ?? '',
    minute: parts.minute ?? '',
  };
}

/** The UK date `days` after today's. */
function ukDateInDays(days: number): Pick<DateTime, 'day' | 'month' | 'year'> {
  const today = ukDateTime(new Date());
  const date = new Date(
    Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + days),
  );
  return {
    day: String(date.getUTCDate()),
    month: String(date.getUTCMonth() + 1),
    year: String(date.getUTCFullYear()),
  };
}

/** The last Sunday of March or October two years ahead, when the UK clocks change. */
function clockChangeDay(month: 3 | 10): Pick<DateTime, 'day' | 'month' | 'year'> {
  const year = new Date().getFullYear() + 2;
  const lastDay = new Date(Date.UTC(year, month, 0));
  const day = lastDay.getUTCDate() - lastDay.getUTCDay();
  return { day: String(day), month: String(month), year: String(year) };
}

function part(page: Page, group: 'Date' | 'Time', label: string) {
  return page.getByRole('group', { name: group }).getByLabel(label, { exact: true });
}

async function fill(page: Page, { day, month, year, hour, minute }: DateTime) {
  await part(page, 'Date', 'Day').fill(day);
  await part(page, 'Date', 'Month').fill(month);
  await part(page, 'Date', 'Year').fill(year);
  await part(page, 'Time', 'Hour').fill(hour);
  await part(page, 'Time', 'Minute').fill(minute);
}

async function expectShown(page: Page, { day, month, year, hour, minute }: DateTime) {
  await expect(part(page, 'Date', 'Day')).toHaveValue(day);
  await expect(part(page, 'Date', 'Month')).toHaveValue(month);
  await expect(part(page, 'Date', 'Year')).toHaveValue(year);
  await expect(part(page, 'Time', 'Hour')).toHaveValue(hour);
  await expect(part(page, 'Time', 'Minute')).toHaveValue(minute);
}

async function submitImpossibleDate(page: Page) {
  await fill(page, { ...LATER, day: '31', month: '2' });
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started with 09:30 offered', async ({
  page,
}) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'When should this indicator be published?' }),
  ).toBeVisible();
  await expectShown(page, { day: '', month: '', year: '', hour: '09', minute: '30' });
});

test('asks for the publishing date when Continue is selected without one', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Enter the publishing date']);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(part(page, 'Date', 'Day')).toBeFocused();
});

test('refuses a date that does not exist, keeping what was typed', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitImpossibleDate(page);

  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Publishing date must be a real date',
  ]);
  await expectShown(page, { ...LATER, day: '31', month: '2' });
});

test('refuses a time that does not exist', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await fill(page, { ...LATER, hour: '24' });
  await page.getByRole('button', { name: 'Continue' }).click();

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Publishing time must be a real time']);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(part(page, 'Time', 'Hour')).toBeFocused();
});

test('refuses a publishing date less than 28 days from today', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await fill(page, { ...ukDateInDays(27), hour: '23', minute: '59' });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Publishing date must be at least 28 days from today',
  ]);
});

test('refuses a time the spring clock change skips', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await fill(page, { ...clockChangeDay(3), hour: '01', minute: '30' });
  await page.getByRole('button', { name: 'Continue' }).click();

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Publishing time must be a real time']);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(part(page, 'Time', 'Hour')).toBeFocused();
});

test('accepts a time the autumn clock change repeats', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const repeated = { ...clockChangeDay(10), hour: '01', minute: '30' };

  await fill(page, repeated);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expectShown(page, repeated);
});

test('saves nothing until the date and time are accepted', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await submitImpossibleDate(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expectShown(page, { day: '', month: '', year: '', hour: '09', minute: '30' });
});

test('saves the date and time on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await fill(page, LATER);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expectShown(page, LATER);
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await expectBackToTaskList(page, taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  await expectNotFoundWithoutDraft(page, SECTION.key);
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the date is refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitImpossibleDate(page);
  await expect(page.getByRole('alert')).toContainText('Publishing date must be a real date');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('saves the date and time', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await fill(page, LATER);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
