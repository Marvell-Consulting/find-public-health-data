import { expect, type Page } from '@playwright/test';

/**
 * The type-to-search input that replaces a select once the page hydrates. Until then the label
 * names the select, so this waits for the input rather than acting on the select.
 */
export function autocompleteInput(page: Page, label: string) {
  return page.getByRole('combobox', { name: label, exact: true }).and(page.locator('input'));
}

/** Chooses an option by typing its name and picking it from the suggestions. */
export async function chooseOption(page: Page, label: string, option: string) {
  const input = autocompleteInput(page, label);
  await input.fill(option);
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(input).toHaveValue(option);
}
