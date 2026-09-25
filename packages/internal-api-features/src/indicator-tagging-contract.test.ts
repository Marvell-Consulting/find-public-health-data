import { describe, expect, it } from 'vitest';

import {
  isTaggingComplete,
  taggingSection as section,
  type TaggingAnswers,
  type TaggingFormValues,
  unknownTagMessage,
} from './indicator-tagging-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const topic = '019fa38f-073f-764e-9ac6-1c4d03b10001';
const otherTopic = '019fa38f-073f-764e-9ac6-1c4d03b10002';
const type = '019fa38f-073f-764e-9ac6-1c4d03b10003';
const riskFactor = '019fa38f-073f-764e-9ac6-1c4d03b10004';
const framework = '019fa38f-073f-764e-9ac6-1c4d03b10005';

const answered: TaggingFormValues = {
  topicIds: [topic, otherTopic],
  indicatorTypeIds: [type],
  hasRiskFactor: 'yes',
  riskFactorIds: [riskFactor],
  hasFramework: 'yes',
  frameworkIds: [framework],
};

const unanswered: TaggingFormValues = {
  topicIds: [],
  indicatorTypeIds: [],
  hasRiskFactor: '',
  riskFactorIds: [],
  hasFramework: '',
  frameworkIds: [],
};

describe('taggingSection', () => {
  it('takes each tag once, in the order it was added', () => {
    expect(
      section.schema.parse({ ...answered, topicIds: [otherTopic, topic, otherTopic] }).topicIds,
    ).toEqual([otherTopic, topic]);
  });

  it('drops the tags beside a "No"', () => {
    expect(
      section.schema.parse({ ...answered, hasRiskFactor: 'no', hasFramework: 'no' }),
    ).toMatchObject({ riskFactorIds: [], frameworkIds: [] });
  });

  it('refuses every unanswered question and empty list at once', () => {
    expect(sectionFieldErrors(section, unanswered)).toEqual({
      topicIds: 'Select at least one topic',
      indicatorTypeIds: 'Select at least one indicator type',
      hasRiskFactor: 'Select whether this indicator includes a risk factor',
      hasFramework: 'Select whether this indicator is part of a framework or programme',
    });
  });

  it('asks for a tag beside each "Yes", along with the other refusals', () => {
    expect(
      sectionFieldErrors(section, {
        ...unanswered,
        hasRiskFactor: 'yes',
        hasFramework: 'yes',
      }),
    ).toEqual({
      topicIds: 'Select at least one topic',
      indicatorTypeIds: 'Select at least one indicator type',
      riskFactorIds: 'Select at least one risk factor',
      frameworkIds: 'Select at least one framework or programme',
    });
  });

  it('refuses a tag that is not an id', () => {
    expect(sectionFieldErrors(section, { ...answered, indicatorTypeIds: ['outcome'] })).toEqual({
      indicatorTypeIds: 'Select an indicator type from the list',
    });
  });
});

describe('unknownTagMessage', () => {
  it('names the tag with its article', () => {
    expect(unknownTagMessage('topicIds')).toBe('Select a topic from the list');
    expect(unknownTagMessage('indicatorTypeIds')).toBe('Select an indicator type from the list');
  });
});

describe('isTaggingComplete', () => {
  const complete: TaggingAnswers = {
    topicIds: [topic],
    indicatorTypeIds: [type],
    hasRiskFactor: 'no',
    riskFactorIds: [],
    hasFramework: 'yes',
    frameworkIds: [framework],
  };

  it.each([
    ['every question answered', complete, true],
    ['no topic', { ...complete, topicIds: [] }, false],
    ['a framework question never answered', { ...complete, hasFramework: null }, false],
    ['a "Yes" with nothing tagged', { ...complete, hasRiskFactor: 'yes' }, false],
  ] satisfies [string, TaggingAnswers, boolean][])('is %s: %s', (_, answers, expected) => {
    expect(isTaggingComplete(answers)).toBe(expected);
  });
});
