import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadValueTypeAndUnits } from './loader.ts';

const id = '00000000-0000-7000-8000-000000000001';
const sectionPath = `/api/internal/indicators/${id}/value-type-and-units`;
const valueTypeId = '01a0d8a5-3ca2-7315-bfca-96d2031a65e7';
const unitId = '01a0d8a5-3ca2-7315-bfca-96d615820bd4';

const options = {
  valueTypes: [{ id: valueTypeId, name: 'Proportion' }],
  units: [{ id: unitId, name: '%' }],
};

const unanswered = {
  valueTypeId: '',
  standardPopulation: '',
  standardPopulationOther: '',
  referencePopulation: '',
  unitId: '',
  unitOther: '',
};

function context(client: Partial<ApiClient>) {
  const provider = new RouterContextProvider();
  provider.set(apiContext, client as ApiClient);
  return provider;
}

function load(indicatorId: string, get: ApiClient['get']) {
  return loadValueTypeAndUnits({
    context: context({ get }),
    params: { id: indicatorId },
    request: new Request(
      `https://internal.test/publish/indicators/${indicatorId}/value-type-and-units`,
    ),
  } as never);
}

function isNotFound(error: unknown) {
  return error instanceof Response && error.status === 404;
}

describe('loadValueTypeAndUnits', () => {
  it("fills the form with the draft's answers and offers every value type and unit", async () => {
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path === sectionPath
          ? {
              valueTypeId,
              standardPopulation: null,
              standardPopulationOther: null,
              referencePopulation: null,
              unitId,
              unitOther: null,
            }
          : options,
      ),
    );

    const outcome = await load(id, get as unknown as ApiClient['get']);

    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
      sectionPath,
      '/api/internal/value-types-and-units',
    ]);
    expect(outcome).toEqual({
      id,
      values: { ...unanswered, valueTypeId, unitId },
      ...options,
    });
  });

  it.each(['108', 'not-an-id'])(
    'answers 404 to an id of %s without asking the API for anything',
    async (bad) => {
      const get = vi.fn();

      await expect(load(bad, get)).rejects.toSatisfy(isNotFound);
      expect(get).not.toHaveBeenCalled();
    },
  );
});
