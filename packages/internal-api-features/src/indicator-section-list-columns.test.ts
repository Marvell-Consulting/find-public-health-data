import { describe, expect, it } from 'vitest';
import type { SexAndAges, Tagging } from './contract.ts';
import type { IndicatorSectionDraft } from './indicator-section.ts';
import {
  denominatorColumns,
  linksColumns,
  numeratorColumns,
  sexAndAgesColumns,
  taggingColumns,
} from './indicator-section-list-columns.ts';
import { links, mortality, onsAlone, TAGS, tagging } from './indicator-sections.testing.ts';
import { unansweredDraft } from './testing.ts';

const draft = {
  numeratorSources: [mortality],
  numeratorDefinition: 'Deaths',
  denominatorSources: [onsAlone],
  denominatorDefinition: 'Population',
} as unknown as IndicatorSectionDraft;

describe('numeratorColumns and denominatorColumns', () => {
  it('read each part from its own sources and definition', () => {
    expect(numeratorColumns.fromDraft(draft)).toEqual({
      sources: [mortality],
      definition: 'Deaths',
    });
    expect(denominatorColumns.fromDraft(draft)).toEqual({
      sources: [onsAlone],
      definition: 'Population',
    });
  });

  it('write the definition as a column and the sources as the list of their part', () => {
    const answers = { sources: [mortality, onsAlone], definition: 'Deaths' };

    expect(numeratorColumns.toAttributes(answers)).toEqual({ numeratorDefinition: 'Deaths' });
    expect(numeratorColumns.toLists?.(answers)).toEqual({ numeratorSources: answers.sources });
    expect(denominatorColumns.toAttributes(answers)).toEqual({ denominatorDefinition: 'Deaths' });
    expect(denominatorColumns.toLists?.(answers)).toEqual({ denominatorSources: answers.sources });
  });
});

describe('linksColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads whether there are links, %s, as %s', (hasLinks, answer) => {
    expect(linksColumns.fromDraft({ ...unansweredDraft, hasLinks }).hasLinks).toBe(answer);
  });

  it('reads the links in the order they are held', () => {
    expect(linksColumns.fromDraft({ ...unansweredDraft, hasLinks: true, links }).links).toEqual(
      links,
    );
  });

  it('writes the links beside "Yes"', () => {
    expect(linksColumns.toAttributes({ hasLinks: 'yes', links })).toEqual({ hasLinks: true });
    expect(linksColumns.toLists?.({ hasLinks: 'yes', links })).toEqual({ links });
  });

  it('clears the links beside "No"', () => {
    expect(linksColumns.toAttributes({ hasLinks: 'no', links })).toEqual({ hasLinks: false });
    expect(linksColumns.toLists?.({ hasLinks: 'no', links })).toEqual({ links: [] });
  });
});

describe('sexAndAgesColumns', () => {
  // Every age type's answers filled in, as a form without JavaScript may send them.
  const everyAnswer = (ageType: SexAndAges['ageType']): SexAndAges => ({
    sexes: ['females', 'males'],
    ageType,
    ageRanges: [{ lowerLimit: '16', lowerLimitUnit: 'years', upperLimit: '', upperLimitUnit: '' }],
    specificAge: '5',
    specificAgeUnit: 'weeks',
    ageDetail: 'School year 6',
  });

  it('reads unanswered sexes as none', () => {
    expect(sexAndAgesColumns.fromDraft(unansweredDraft)).toEqual({
      sexes: [],
      ageType: null,
      ageRanges: [],
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
  });

  it('writes the ranges, with each limit left empty as null, and nothing else beside a range', () => {
    const values = everyAnswer('range');

    expect(sexAndAgesColumns.toAttributes(values)).toEqual({
      sexes: ['females', 'males'],
      ageType: 'range',
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({
      ageRanges: [
        { lowerLimit: 16, lowerLimitUnit: 'years', upperLimit: null, upperLimitUnit: null },
      ],
    });
  });

  it('writes the specific age as a number, and nothing else beside it', () => {
    const values = everyAnswer('specific');

    expect(sexAndAgesColumns.toAttributes(values)).toMatchObject({
      specificAge: 5,
      specificAgeUnit: 'weeks',
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });

  it('writes all ages, and nothing else beside them', () => {
    const values = everyAnswer('all');

    expect(sexAndAgesColumns.toAttributes(values)).toEqual({
      sexes: ['females', 'males'],
      ageType: 'all',
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });

  it('writes the other ages, and nothing else beside them', () => {
    const values = everyAnswer('other');

    expect(sexAndAgesColumns.toAttributes(values)).toMatchObject({
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: 'School year 6',
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });
});

describe('taggingColumns', () => {
  it('reads each dimension of the classifications as its own list', () => {
    expect(
      taggingColumns.fromDraft({
        ...unansweredDraft,
        hasRiskFactor: true,
        hasFramework: false,
        topicIds: [TAGS.topic],
        classifications: [
          { id: TAGS.framework, dimension: 'framework' },
          { id: TAGS.type, dimension: 'indicator_type' },
          { id: '019fa38f-073f-764e-9ac6-1c4d03b10006', dimension: 'population' },
          { id: TAGS.riskFactor, dimension: 'risk_factor' },
        ],
      }),
    ).toEqual({
      topicIds: [TAGS.topic],
      indicatorTypeIds: [TAGS.type],
      hasRiskFactor: 'yes',
      riskFactorIds: [TAGS.riskFactor],
      hasFramework: 'no',
      frameworkIds: [TAGS.framework],
    });
  });

  it('writes the answers and replaces only the dimensions the page asks about', () => {
    expect(taggingColumns.toAttributes(tagging)).toEqual({
      hasRiskFactor: true,
      hasFramework: false,
    });
    expect(taggingColumns.toLists?.(tagging)).toEqual({
      topicIds: [TAGS.otherTopic, TAGS.topic],
      classificationIds: {
        indicator_type: [TAGS.type],
        risk_factor: [TAGS.riskFactor],
        framework: [],
      },
    });
  });

  it('drops the tags beside a "No", whatever the form sent', () => {
    const sent: Tagging = {
      ...tagging,
      hasRiskFactor: 'no',
      hasFramework: 'no',
      frameworkIds: [TAGS.framework],
    };

    expect(taggingColumns.toLists?.(sent)).toMatchObject({
      classificationIds: { risk_factor: [], framework: [] },
    });
  });
});
