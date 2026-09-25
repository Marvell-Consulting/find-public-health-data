import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadPublishingDate } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';

const unanswered = {
  publishingDateDay: null,
  publishingDateMonth: null,
  publishingDateYear: null,
  publishingTimeHour: null,
  publishingTimeMinute: null,
};

function load(answers: Record<string, string | null>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, { get: vi.fn().mockResolvedValue(answers) } as unknown as ApiClient);

  return loadPublishingDate({
    context: provider,
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/publishing-date`),
  } as never);
}

describe('loadPublishingDate', () => {
  it('offers 09:30 on a draft with no publishing date', async () => {
    expect((await load(unanswered)).values).toEqual({
      publishingDateDay: '',
      publishingDateMonth: '',
      publishingDateYear: '',
      publishingTimeHour: '09',
      publishingTimeMinute: '30',
    });
  });

  it('shows the saved date and time', async () => {
    const answers = {
      publishingDateDay: '4',
      publishingDateMonth: '1',
      publishingDateYear: '2027',
      publishingTimeHour: '15',
      publishingTimeMinute: '05',
    };

    expect(await load(answers)).toEqual({ id, values: answers });
  });
});
