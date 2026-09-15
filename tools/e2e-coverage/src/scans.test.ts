import { describe, expect, it } from 'vitest';

import { callsScan } from './scans.js';

describe('callsScan', () => {
  it.each([
    'await expectNoAccessibilityViolations(page, testInfo);',
    "test('scans', async ({ page }, testInfo) => {\n  await expectNoAccessibilityViolations(page, testInfo);\n});",
    'if (javaScriptEnabled) await expectNoAccessibilityViolations(page, testInfo);',
  ])('finds a real call: %s', (source) => {
    expect(callsScan(source)).toBe(true);
  });

  it.each([
    "import { expectNoAccessibilityViolations } from '../support/accessibility.js';",
    '// await expectNoAccessibilityViolations(page, testInfo);',
    '/* expectNoAccessibilityViolations(page, testInfo) */',
    "const note = 'expectNoAccessibilityViolations(page, testInfo)';",
    'await helper.expectNoAccessibilityViolations(page);',
    "test('renders', async () => {});",
  ])('ignores anything that is not a call to it: %s', (source) => {
    expect(callsScan(source)).toBe(false);
  });
});
