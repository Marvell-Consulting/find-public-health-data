import { schema } from '@fphd/db';
import { MAX_AGE } from '@fphd/utils/sex-and-ages';
import { desc, eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { getIndicatorDraftState, updateIndicatorDraft } from './indicator-draft-repository.ts';
import {
  ACTOR,
  classificationIn,
  commentary,
  fingertips,
  newDraft,
  onsSources,
  repositoryTest,
  sixteenPlus,
  storedAgeRangesOf,
  storedClassificationIdsOf,
  storedLinksOf,
  storedTopicIdsOf,
  typeClassification,
  underFive,
} from './indicator-repository.testing.ts';
import type { IndicatorDraftAgeRange } from './indicator-version-lists-repository.ts';

const { indicatorVersionClassification } = schema;

describe('updateIndicatorDraft', () => {
  repositoryTest('leaves the lists alone when the update names none', async ({ db }) => {
    const created = await newDraft(db, 'Keeps its links');
    const [topic] = await db.select({ id: schema.topic.id }).from(schema.topic).limit(1);
    const classified = await typeClassification(db);
    if (!topic || !classified) throw new Error('The seed holds no topics or classifications');
    await updateIndicatorDraft(
      db,
      created.indicatorId,
      {},
      {
        topicIds: [topic.id],
        classificationIds: { indicator_type: [classified.id] },
        links: [commentary],
      },
      ACTOR,
    );

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { name: 'Keeps its links renamed' },
      {},
      ACTOR,
    );

    expect(await storedTopicIdsOf(db, created.versionId)).toEqual([topic.id]);
    const classifications = await db
      .select({ id: indicatorVersionClassification.classificationId })
      .from(indicatorVersionClassification)
      .where(eq(indicatorVersionClassification.indicatorVersionId, created.versionId));
    expect(classifications).toEqual([{ id: classified.id }]);
    expect(await storedLinksOf(db, created.versionId)).toEqual([commentary]);
  });

  repositoryTest(
    'replaces the classifications of the dimensions given and leaves the others',
    async ({ db }) => {
      const created = await newDraft(db, 'Tagged by dimension');
      const population = await classificationIn(db, 'population');
      const riskFactor = await classificationIn(db, 'risk_factor');
      const type = await typeClassification(db);
      await updateIndicatorDraft(
        db,
        created.indicatorId,
        {},
        { classificationIds: { population: [population.id], risk_factor: [riskFactor.id] } },
        ACTOR,
      );

      await updateIndicatorDraft(
        db,
        created.indicatorId,
        {},
        { classificationIds: { indicator_type: [type.id], risk_factor: [] } },
        ACTOR,
      );

      expect(await storedClassificationIdsOf(db, created.versionId)).toEqual(
        [population.id, type.id].sort(),
      );
    },
  );

  repositoryTest('reads back the tags and their answers', async ({ db }) => {
    const created = await newDraft(db, 'Tags read back');
    const topics = await db
      .select({ id: schema.topic.id, title: schema.topic.title })
      .from(schema.topic)
      .orderBy(desc(schema.topic.title))
      .limit(2);
    const riskFactor = await classificationIn(db, 'risk_factor');

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { hasRiskFactor: true, hasFramework: false },
      {
        topicIds: topics.map(({ id }) => id),
        classificationIds: { risk_factor: [riskFactor.id] },
      },
      ACTOR,
    );

    const state = await getIndicatorDraftState(db, created.indicatorId);
    expect(state?.draft).toMatchObject({
      hasRiskFactor: true,
      hasFramework: false,
      // Ordered by title, whatever order they were written in.
      topicIds: topics.map(({ id }) => id).reverse(),
      classifications: [{ id: riskFactor.id, dimension: 'risk_factor' }],
    });
  });

  repositoryTest(
    'writes the links in the order given, replacing those held before',
    async ({ db }) => {
      const created = await newDraft(db, 'Links in order');

      await updateIndicatorDraft(
        db,
        created.indicatorId,
        { hasLinks: true },
        { links: [commentary, fingertips] },
        ACTOR,
      );
      const first = await getIndicatorDraftState(db, created.indicatorId);
      await updateIndicatorDraft(db, created.indicatorId, {}, { links: [fingertips] }, ACTOR);
      const replaced = await getIndicatorDraftState(db, created.indicatorId);
      await updateIndicatorDraft(
        db,
        created.indicatorId,
        { hasLinks: false },
        { links: [] },
        ACTOR,
      );
      const cleared = await getIndicatorDraftState(db, created.indicatorId);

      expect(first?.draft).toMatchObject({ hasLinks: true, links: [commentary, fingertips] });
      expect(replaced?.draft?.links).toEqual([fingertips]);
      expect(cleared?.draft).toMatchObject({ hasLinks: false, links: [] });
    },
  );

  repositoryTest(
    'writes the sexes and age ranges in the order given, replacing those held before',
    async ({ db }) => {
      const created = await newDraft(db, 'Ages in order');

      await updateIndicatorDraft(
        db,
        created.indicatorId,
        { sexes: ['females', 'males'], ageType: 'range' },
        { ageRanges: [underFive, sixteenPlus] },
        ACTOR,
      );
      const first = await getIndicatorDraftState(db, created.indicatorId);
      await updateIndicatorDraft(
        db,
        created.indicatorId,
        { ageType: 'specific', specificAge: 5, specificAgeUnit: 'weeks' },
        { ageRanges: [] },
        ACTOR,
      );
      const replaced = await getIndicatorDraftState(db, created.indicatorId);

      expect(first?.draft).toMatchObject({
        sexes: ['females', 'males'],
        ageType: 'range',
        ageRanges: [underFive, sixteenPlus],
      });
      expect(replaced?.draft).toMatchObject({
        ageType: 'specific',
        specificAge: 5,
        specificAgeUnit: 'weeks',
        ageRanges: [],
      });
    },
  );

  repositoryTest('holds ages up to the highest', async ({ db }) => {
    const created = await newDraft(db, 'Ages up to the highest');
    const oldest = { ...underFive, upperLimit: MAX_AGE };

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { ageType: 'range' },
      { ageRanges: [oldest] },
      ACTOR,
    );
    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { ageType: 'specific', specificAge: MAX_AGE, specificAgeUnit: 'days' },
      {},
      ACTOR,
    );

    expect((await getIndicatorDraftState(db, created.indicatorId))?.draft).toMatchObject({
      specificAge: MAX_AGE,
      ageRanges: [oldest],
    });
  });

  repositoryTest.for<[string, IndicatorDraftAgeRange]>([
    ['no limit', { ...sixteenPlus, lowerLimit: null, lowerLimitUnit: null }],
    ['a limit without its unit', { ...sixteenPlus, lowerLimitUnit: null }],
    ['a unit without its limit', { ...underFive, lowerLimitUnit: 'years' }],
    ['a negative limit', { ...sixteenPlus, lowerLimit: -1 }],
    ['a limit above the highest', { ...underFive, upperLimit: MAX_AGE + 1 }],
    [
      'an upper limit below the lower',
      { lowerLimit: 5, lowerLimitUnit: 'years', upperLimit: 4, upperLimitUnit: 'years' },
    ],
  ])('refuses an age range with %s', async ([name, ageRange], { db }) => {
    const created = await newDraft(db, `Refuses a range with ${name}`);

    await expect(
      updateIndicatorDraft(db, created.indicatorId, {}, { ageRanges: [ageRange] }, ACTOR),
    ).rejects.toThrow();
  });

  repositoryTest(
    'holds an upper limit the same age as the lower in another unit',
    async ({ db }) => {
      const created = await newDraft(db, 'Limits in different units');
      const firstYear = {
        lowerLimit: 12,
        lowerLimitUnit: 'months',
        upperLimit: 1,
        upperLimitUnit: 'years',
      } as const;

      await updateIndicatorDraft(
        db,
        created.indicatorId,
        { ageType: 'range' },
        { ageRanges: [firstYear] },
        ACTOR,
      );

      expect(await storedAgeRangesOf(db, created.versionId)).toEqual([firstYear]);
    },
  );

  repositoryTest(
    "writes each part's sources in the order given, replacing that part's alone",
    async ({ db }) => {
      const created = await newDraft(db, 'Sources in order');
      const { liveBirths, onsAlone } = await onsSources(db);

      await updateIndicatorDraft(
        db,
        created.indicatorId,
        {},
        { numeratorSources: [liveBirths, onsAlone], denominatorSources: [onsAlone] },
        ACTOR,
      );
      const first = await getIndicatorDraftState(db, created.indicatorId);
      await updateIndicatorDraft(
        db,
        created.indicatorId,
        {},
        { numeratorSources: [onsAlone] },
        ACTOR,
      );
      const replaced = await getIndicatorDraftState(db, created.indicatorId);

      expect(first?.draft).toMatchObject({
        numeratorSources: [liveBirths, onsAlone],
        denominatorSources: [onsAlone],
      });
      expect(replaced?.draft).toMatchObject({
        numeratorSources: [onsAlone],
        denominatorSources: [onsAlone],
      });
    },
  );

  repositoryTest('refuses a source under a provider it does not belong to', async ({ db }) => {
    const created = await newDraft(db, 'Source under another provider');
    const { liveBirths } = await onsSources(db);
    const [other] = await db
      .select({ id: schema.dataProvider.id })
      .from(schema.dataProvider)
      .where(eq(schema.dataProvider.name, 'Estimated'));
    if (!other) throw new Error('The core data holds no Estimated provider');

    await expect(
      updateIndicatorDraft(
        db,
        created.indicatorId,
        {},
        { numeratorSources: [{ providerId: other.id, sourceId: liveBirths.sourceId }] },
        ACTOR,
      ),
    ).rejects.toThrow();
  });
});

describe('indicator_version_classification', () => {
  repositoryTest('follows the draft rather than the indicator', async ({ db }) => {
    const created = await newDraft(db, 'Classified');
    const classified = await typeClassification(db);
    if (!classified) throw new Error('The seed holds no classifications');

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      {},
      { classificationIds: { indicator_type: [classified.id] } },
      ACTOR,
    );

    const rows = await db
      .select({ versionId: indicatorVersionClassification.indicatorVersionId })
      .from(indicatorVersionClassification)
      .where(eq(indicatorVersionClassification.indicatorVersionId, created.versionId));

    expect(rows).toEqual([{ versionId: created.versionId }]);
  });
});
