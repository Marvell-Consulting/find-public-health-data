import { describe, expect, it } from 'vitest';

import { TimedUploadError, timed } from './data-upload-timings.ts';

describe('timed', () => {
  it('answers the step’s result with the whole milliseconds it took', async () => {
    const [result, ms] = await timed(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return 'done';
    });

    expect(result).toBe('done');
    expect(Number.isInteger(ms)).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(15);
  });

  it('lets a failing step’s error through', async () => {
    const failure = new Error('step failed');

    await expect(timed(() => Promise.reject(failure))).rejects.toBe(failure);
  });
});

describe('TimedUploadError', () => {
  it('carries the timings reached and the failure that stopped the upload', () => {
    const failure = new Error('database is down');

    const error = new TimedUploadError({ lockWaitMs: 3 }, failure);

    expect(error.timings).toEqual({ lockWaitMs: 3 });
    expect(error.cause).toBe(failure);
  });
});
