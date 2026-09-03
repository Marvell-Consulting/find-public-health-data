import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

// WCAG 2.2 AA is the acceptance bar. axe tags each rule with the version that introduced it,
// so the 2.2 tag alone would skip every rule carried forward from 2.0 and 2.1.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type Violation = AxeResults['violations'][number];
type ViolationNode = Violation['nodes'][number];

/**
 * A ticketed defect the scan tolerates while its fix waits. Only that rule on elements matching
 * that selector is let through, wherever the element appears, so the rest of the page is still
 * held to the bar. A page whose path matches `expectedOn` must still show it: once the fix
 * lands, that page's scan fails until the entry goes.
 */
type KnownViolation = {
  expectedOn: RegExp;
  rule: string;
  selector: string;
  ticket: string;
};

const KNOWN_VIOLATIONS: KnownViolation[] = [
  {
    // The filter card's Clear all link is blue on the card's grey header: 3.4:1 against the 4.5:1
    // WCAG 1.4.3 needs. Awaiting a design decision on the link colour or the header colour.
    ticket: 'FPH-370',
    rule: 'color-contrast',
    selector: '.fphd-filter-card__header .govuk-link',
    expectedOn: /^\/indicators\/\d+$/,
  },
];

function describeViolation(violation: Violation): string {
  const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
  return `${violation.id} (${violation.impact}): ${violation.help} at ${targets}`;
}

async function findKnown(
  page: Page,
  violation: Violation,
  node: ViolationNode,
): Promise<KnownViolation | undefined> {
  for (const known of KNOWN_VIOLATIONS) {
    if (known.rule !== violation.id) {
      continue;
    }
    const element = page.locator(node.target.join(' ')).first();
    if (await element.evaluate((el, selector) => el.matches(selector), known.selector)) {
      return known;
    }
  }
  return undefined;
}

/** Splits the scan's violations into those still to report and the known ones it matched. */
async function separateKnown(page: Page, violations: Violation[]) {
  const seen = new Set<KnownViolation>();
  const unknown: Violation[] = [];
  for (const violation of violations) {
    const nodes: ViolationNode[] = [];
    for (const node of violation.nodes) {
      const known = await findKnown(page, violation, node);
      if (known) {
        seen.add(known);
      } else {
        nodes.push(node);
      }
    }
    if (nodes.length > 0) {
      unknown.push({ ...violation, nodes });
    }
  }
  return { seen, unknown };
}

/** Scans the page as it currently stands; call it after driving the page into the state under test. */
export async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const { incomplete, violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const { seen, unknown } = await separateKnown(page, violations);
  // `incomplete` is what axe could not decide, such as text over a gradient: the manual-review
  // list, attached alongside so a failure carries everything the scan had to say.
  if (unknown.length > 0) {
    await testInfo.attach('axe-results.json', {
      body: JSON.stringify({ violations: unknown, incomplete }, null, 2),
      contentType: 'application/json',
    });
  }
  expect(unknown.map(describeViolation)).toEqual([]);

  const pathname = new URL(page.url()).pathname;
  const fixed = KNOWN_VIOLATIONS.filter(
    (known) => known.expectedOn.test(pathname) && !seen.has(known),
  );
  expect(
    fixed.map((known) => known.ticket),
    'known violations no longer seen on this page: remove them from KNOWN_VIOLATIONS',
  ).toEqual([]);
}
