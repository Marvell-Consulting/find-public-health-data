import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { taxonomyRelationships } from './taxonomy.ts';

const data = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../packages/db/data/${name}.json`, import.meta.url), 'utf8'),
  );
const source = data('taxonomy-v2');
const topics = data('topics');
const subtopics = data('subtopics');
const classifications = data('classifications');
const build = (input = source, selection?: number[]) =>
  taxonomyRelationships(input, topics, subtopics, classifications, selection);

describe('the V2 workbook assignments', () => {
  it('reproduces the committed relationships without inferring memberships', () => {
    const file = build();
    expect(file).toEqual(data('published-indicator-topics'));
    expect(file.indicators).toHaveLength(880);
    expect(file.areaContextIndicators).toHaveLength(15);
    expect(file.indicatorTopics.filter(({ isPrimary }) => isPrimary)).toHaveLength(865);
    expect(topics).toHaveLength(19);
    expect(subtopics).toHaveLength(92);
    expect(
      classifications.filter(({ isActive }: { isActive?: boolean }) => isActive !== false),
    ).toHaveLength(28);
  });

  it('keeps two mortality subtopics for indicator 108 under one primary topic', () => {
    const file = build(source, [108]);
    expect(file.indicatorTopics).toHaveLength(1);
    expect(file.indicatorTopics[0]?.isPrimary).toBe(true);
    expect(file.indicatorSubtopics).toHaveLength(2);
    expect(file.indicatorSubtopics.filter(({ isPrimary }) => isPrimary)).toHaveLength(1);
  });

  it('leaves population indicators explicitly untagged as area context', () => {
    expect(build(source, [92708])).toMatchObject({
      indicators: [92708],
      areaContextIndicators: [92708],
      indicatorTopics: [],
      indicatorSubtopics: [],
      indicatorClassifications: [],
    });
  });

  it('does not manufacture a placement for an indicator excluded from the workbook', () => {
    expect(() => build(source, [359])).toThrow('Indicators absent from the in-scope taxonomy: 359');
  });

  it('keeps the explicitly selected cancer dataset under its provisional reviewed placement', () => {
    const file = build(source, [276]);
    const topicId = topics.find(({ title }: { title: string }) => title === 'Cancer').id;
    const subtopicId = subtopics.find(
      ({ topicId: parent, title }: { topicId: string; title: string }) =>
        parent === topicId && title === 'All cancers',
    ).id;
    expect(file).toMatchObject({
      indicators: [276],
      areaContextIndicators: [],
      indicatorTopics: [{ fingertipsId: 276, topicId, isPrimary: true }],
      indicatorSubtopics: [{ fingertipsId: 276, topicId, subtopicId, isPrimary: true }],
      indicatorClassifications: [],
    });
    expect(build().indicators).not.toContain(276);
  });

  it('requires review when the excluded cancer source entry changes', () => {
    const changed = structuredClone(source);
    changed.outOfScope.find(
      ({ fingertipsId }: { fingertipsId: number }) => fingertipsId === 276,
    ).name = 'Changed cancer indicator';
    expect(() => build(changed, [276])).toThrow(
      'Indicators absent from the in-scope taxonomy: 276',
    );
  });

  it('rejects ambiguous primaries and unknown subtopics', () => {
    const ambiguous = structuredClone(source);
    const indicator = ambiguous.indicators.find(
      ({ fingertipsId }: { fingertipsId: number }) => fingertipsId === 108,
    );
    indicator.placements[1].primary = true;
    expect(() => build(ambiguous, [108])).toThrow('exactly one primary placement: 108');
    indicator.placements[1].primary = false;
    indicator.placements[1].subtopic = 'Unreviewed guess';
    expect(() => build(ambiguous, [108])).toThrow('Unknown taxonomy subtopic');
  });

  it('keeps dental and sensory indicators at topic level', () => {
    const ids = source.indicators
      .filter((indicator: { placements: { topic: string }[] }) =>
        indicator.placements.some(
          ({ topic }) => topic === 'Dental and oral health' || topic === 'Sight and hearing',
        ),
      )
      .map(({ fingertipsId }: { fingertipsId: number }) => fingertipsId);
    const file = build(source, ids);
    const topicIds = new Set(
      topics
        .filter(({ title }: { title: string }) =>
          ['Dental and oral health', 'Sight and hearing'].includes(title),
        )
        .map(({ id }: { id: string }) => id),
    );
    expect(file.indicatorSubtopics.filter(({ topicId }) => topicIds.has(topicId))).toEqual([]);
  });
});
