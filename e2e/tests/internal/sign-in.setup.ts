import { test as setup } from '@playwright/test';

import { ADMIN, PUBLISHER, signInAs, TEAM_B_PUBLISHER } from '../support/sign-in.ts';

for (const user of [PUBLISHER, TEAM_B_PUBLISHER, ADMIN]) {
  setup(`signs in as ${user.name}`, async ({ page }) => {
    await signInAs(page, user.name);
    await page.context().storageState({ path: user.storageState });
  });
}
