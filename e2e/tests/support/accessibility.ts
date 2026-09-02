import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

// WCAG 2.2 AA is the acceptance bar. axe tags each rule with the version that introduced it,
// so the 2.2 tag alone would skip every rule carried forward from 2.0 and 2.1.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

function describeViolation(violation: Violation): string {
  const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
  return `${violation.id} (${violation.impact}): ${violation.help} at ${targets}`;
}

/** Scans the page as it currently stands; call it after driving the page into the state under test. */
export async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  if (violations.length > 0) {
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    });
  }
  expect(violations.map(describeViolation)).toEqual([]);
}
