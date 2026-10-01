import { request } from '@fphd/express/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  benchmarkingSection,
  calculationSection,
  confidenceIntervalsSection,
  copyrightAndDataReuseSection,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  indicatorTaskKeySchema,
  justificationsSection,
  linksSection,
  numeratorSection,
  otherCommentsSection,
  otherNotesAndCaveatsSection,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  sexAndAgesSection,
  taggingSection,
  updateFrequencySection,
  valueTypeAndUnitsSection,
  varianceAndQualitySection,
} from './contract.ts';
import { links } from './indicator-section-fixtures.ts';
import { indicatorSectionsRouter } from './indicator-sections.ts';
import {
  createFakeInternalRepositories,
  createRouterTestApp,
  testSessionCookie,
  testSessionVerifier,
  unansweredDraft,
} from './testing.ts';

// The HTTP behaviour every section shares is tested in indicator-section.test.ts.

// Every section the router serves.
const sections = [
  benchmarkingSection,
  calculationSection,
  confidenceIntervalsSection,
  copyrightAndDataReuseSection,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  justificationsSection,
  linksSection,
  numeratorSection,
  otherCommentsSection,
  otherNotesAndCaveatsSection,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  sexAndAgesSection,
  taggingSection,
  updateFrequencySection,
  valueTypeAndUnitsSection,
  varianceAndQualitySection,
];

describe('indicatorSectionsRouter', () => {
  it('serves every task but the name', () => {
    expect(sections.map(({ key }) => key).sort()).toEqual(
      indicatorTaskKeySchema.options.filter((key) => key !== 'name').sort(),
    );
  });

  it.each(sections)(
    'serves the $key section, answering every field as null or an empty list',
    async (section) => {
      const repositories = createFakeInternalRepositories({
        indicators: { findDraftState: vi.fn().mockResolvedValue({ draft: unansweredDraft }) },
      });

      const response = await request(
        createRouterTestApp(indicatorSectionsRouter(repositories, testSessionVerifier)),
      )
        .get(`/api/internal/indicators/00000000-0000-7000-8000-000000000001/${section.key}`)
        .set('Cookie', await testSessionCookie(['internal', 'publisher']));

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual([...section.fields.options].sort());
      for (const answer of Object.values(response.body)) {
        expect(answer === null || (Array.isArray(answer) && answer.length === 0)).toBe(true);
      }
    },
  );

  it('writes the lists a section gives beside its columns', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const repositories = createFakeInternalRepositories({
      indicators: {
        updateDraft,
        findDraftState: vi
          .fn()
          .mockResolvedValue({ draft: { ...unansweredDraft, hasLinks: true, links } }),
      },
    });

    const response = await request(
      createRouterTestApp(indicatorSectionsRouter(repositories, testSessionVerifier)),
    )
      .put('/api/internal/indicators/00000000-0000-7000-8000-000000000001/links')
      .set('Cookie', await testSessionCookie(['internal', 'publisher']))
      .send({ hasLinks: 'yes', links });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000001',
      { hasLinks: true },
      { links },
      'test-user',
    );
    expect(response.body).toEqual({ hasLinks: 'yes', links });
  });
});
