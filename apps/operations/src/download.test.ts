import { expect, it } from 'vitest';
import { downloadFile } from './download.ts';

it('refuses a plain HTTP URL before requesting it', async () => {
  await expect(
    downloadFile('http://example.test/package', '/unused/path', 'Package'),
  ).rejects.toThrow('Package URL must use HTTPS');
});
