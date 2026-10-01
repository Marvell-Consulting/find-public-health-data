import { type Database, listIndicatorFacets } from '@fphd/db';
import { describe, expect } from 'vitest';

import { updateIndicatorDraft } from './indicator-draft-repository.ts';
import { getIndicatorById, listIndicatorsPage } from './indicator-list-repository.ts';
import { createDraftFromPublished } from './indicator-publish-repository.ts';
import {
  ACTOR,
  idsNewestFirst,
  indicatorWithTwoPublications,
  newDraft,
  repositoryTest,
} from './indicator-repository.testing.ts';

describe('listIndicatorsPage', () => {
  repositoryTest('pages through every indicator, most recently edited first', async ({ db }) => {
    const expected = await idsNewestFirst(db);
    const pageSize = Math.ceil(expected.length / 2);

    const first = await listIndicatorsPage(db, 1, pageSize);
    const second = await listIndicatorsPage(db, 2, pageSize);

    expect(first.total).toBe(expected.length);
    expect(second.total).toBe(expected.length);
    expect([...first.indicators, ...second.indicators].map((row) => row.id)).toEqual(expected);
    // The API serialises this, so a driver string rather than a Date is a 500.
    expect(first.indicators[0]?.updatedAt).toBeInstanceOf(Date);
  });

  repositoryTest(
    'returns an empty page past the end, still reporting the total',
    async ({ db }) => {
      const expected = await idsNewestFirst(db);

      const page = await listIndicatorsPage(db, 2, expected.length);

      expect(page.indicators).toEqual([]);
      expect(page.total).toBe(expected.length);
    },
  );

  repositoryTest(
    'includes an indicator with no published version, which the public listing hides',
    async ({ db }) => {
      const created = await newDraft(db, 'A draft-only indicator');

      const page = await listIndicatorsPage(db, 1, 1);

      expect(page.indicators[0]).toMatchObject({
        id: created.indicatorId,
        name: 'A draft-only indicator',
      });
    },
  );
});

describe('the derived statuses', () => {
  /** The whole listing, so a case finds its own row wherever the order put it. */
  async function listed(db: Database, id: string) {
    const page = await listIndicatorsPage(db, 1, (await idsNewestFirst(db)).length);
    return page.indicators.find((row) => row.id === id);
  }

  repositoryTest('reads a draft with nothing published as new and unsubmitted', async ({ db }) => {
    const created = await newDraft(db, 'A first draft');
    const statuses = { indicatorStatus: 'new', draftStatus: 'draft' };

    expect(await listed(db, created.indicatorId)).toMatchObject(statuses);
    expect(await getIndicatorById(db, created.indicatorId)).toMatchObject(statuses);
  });

  repositoryTest(
    'reads a published indicator with no draft as live and nothing in flight',
    async ({ db }) => {
      const { indicatorId } = await indicatorWithTwoPublications(db, 'Live with no draft');
      const statuses = { indicatorStatus: 'live', draftStatus: null };

      expect(await listed(db, indicatorId)).toMatchObject(statuses);
      expect(await getIndicatorById(db, indicatorId)).toMatchObject(statuses);
    },
  );

  repositoryTest(
    'reads a draft of a published indicator as live with an unsubmitted draft',
    async ({ db }) => {
      const { indicatorId } = await indicatorWithTwoPublications(db, 'Live with a draft');
      await createDraftFromPublished(db, indicatorId, ACTOR);
      const statuses = { indicatorStatus: 'live', draftStatus: 'draft' };

      expect(await listed(db, indicatorId)).toMatchObject(statuses);
      expect(await getIndicatorById(db, indicatorId)).toMatchObject(statuses);
    },
  );
});

describe('getIndicatorById', () => {
  repositoryTest(
    'reads an indicator by its row id, with the public number',
    async ({ db, seededIds }) => {
      const target = seededIds[0];
      if (target === undefined) throw new Error('The seed holds no indicators');

      const found = await getIndicatorById(db, target);

      expect(found).toMatchObject({ id: target, indicatorStatus: 'live' });
      expect(found?.updatedAt).toBeInstanceOf(Date);
      expect(found?.shortId).toEqual(expect.any(Number));
      expect(found?.name).not.toBe('');
    },
  );

  repositoryTest(
    'prefers the draft name once a draft version exists',
    async ({ db, seededIds }) => {
      const target = seededIds.at(-1);
      if (target === undefined) throw new Error('The seed holds no indicators');

      await createDraftFromPublished(db, target, ACTOR);
      await updateIndicatorDraft(db, target, { name: 'Edited in a draft' }, {}, ACTOR);

      expect(await getIndicatorById(db, target)).toMatchObject({
        draftStatus: 'draft',
        name: 'Edited in a draft',
      });
    },
  );

  repositoryTest('reads the most recently published version when several exist', async ({ db }) => {
    const { indicatorId, currentId, currentName, currentSlug, supersededId } =
      await indicatorWithTwoPublications(db, 'Published twice');

    const found = await getIndicatorById(db, indicatorId);

    expect(supersededId > currentId).toBe(true);
    expect(found).toMatchObject({
      name: currentName,
      publishedSlug: currentSlug,
    });
    expect(found?.updatedAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  repositoryTest('returns nothing for an id no indicator has', async ({ db }) => {
    expect(await getIndicatorById(db, '00000000-0000-7000-8000-000000000000')).toBeUndefined();
  });
});

describe('sharing one connection with the public repositories', () => {
  // internal-api serves both surfaces from one connection, and drizzle keys its column-name
  // cache on the unqualified relation name: the indicator table must not shadow the view.
  repositoryTest(
    'reads the indicator table and the published indicator view in one process',
    async ({ db }) => {
      await listIndicatorsPage(db, 1, 1);

      await expect(listIndicatorFacets(db)).resolves.toMatchObject({
        sources: expect.any(Array),
        valueTypes: expect.any(Array),
      });
    },
  );
});
