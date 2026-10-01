import { test as setup } from '@playwright/test';

import { ADMIN, PUBLISHER, signInAs } from '../support/sign-in.ts';

for (const user of [PUBLISHER, ADMIN]) {
  setup(`signs in as ${user.name}`, async ({ page }) => {
    await signInAs(page, user.name);
    await page.context().storageState({ path: user.storageState });
  });
}
