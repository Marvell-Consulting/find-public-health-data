import { expect, type Page } from '@playwright/test';

/**
 * The type-to-search input that replaces a select once the page hydrates. Until then the label
 * names the select, so this waits for the input rather than acting on the select.
 */
export function autocompleteInput(page: Page, label: string) {
  return page.getByRole('combobox', { name: label, exact: true }).and(page.locator('input'));
}

/**
 * Chooses an option by typing its name and picking it from the field's own suggestions, then
 * checks the menu closed on the pick and the hidden select holds the choice the form submits.
 */
export async function chooseOption(page: Page, label: string, option: string) {
  const input = autocompleteInput(page, label);
  await input.fill(option);
  const listbox = page.locator(`[id="${await input.getAttribute('aria-controls')}"]`);
  await listbox.getByRole('option', { name: option, exact: true }).click();
  await expect(listbox).toBeHidden();
  await expect(input).toHaveValue(option);
  await expect(
    page.locator(`select[id="${await input.getAttribute('id')}-select"] option:checked`),
  ).toHaveText(option);
}
