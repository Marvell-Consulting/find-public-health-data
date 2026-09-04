import { readFile } from 'node:fs/promises';

import type { Download, Page } from '@playwright/test';

/** Clicks the named button and returns the file it downloads, as text. */
export async function downloadFrom(page: Page, buttonName: string) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName }).click();
  const download = await downloading;
  return { filename: download.suggestedFilename(), text: await readText(download) };
}

async function readText(download: Download) {
  const path = await download.path();
  return readFile(path, 'utf8');
}
