// Builds the seeded template database the integration tier copies per test file.
// Gated on INTEGRATION_DB so the unit tier never touches Postgres; the
// test:integration script sets it.
export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  if (process.env.INTEGRATION_DB !== '1') {
    return undefined;
  }
  const { setUpTestTemplate, tearDownTestTemplate } = await import('@fphd/db/testing');
  await setUpTestTemplate();
  return async () => {
    await tearDownTestTemplate();
  };
}
