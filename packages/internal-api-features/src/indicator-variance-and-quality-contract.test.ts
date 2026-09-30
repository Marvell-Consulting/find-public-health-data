import { describe, expect, it } from 'vitest';
import { varianceAndQualitySection as section } from './indicator-variance-and-quality-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const answered = {
  variation: 'Varies with the age structure of each area.',
  qualityAssurance: 'Checked against the published ONS figures.',
  hasSourceDataIssues: 'no',
  sourceDataIssuesDetail: '',
};

describe('varianceAndQualitySection', () => {
  it('takes every answer without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        variation: ' Varies by area.\n',
        qualityAssurance: '\tChecked. ',
        hasSourceDataIssues: 'yes',
        sourceDataIssuesDetail: '  Late returns. ',
      }),
    ).toEqual({
      variation: 'Varies by area.',
      qualityAssurance: 'Checked.',
      hasSourceDataIssues: 'yes',
      sourceDataIssuesDetail: 'Late returns.',
    });
  });

  it('asks for no details when there are no source data issues', () => {
    expect(sectionFieldErrors(section, answered)).toBeUndefined();
  });

  it('asks for every answer when the form is empty', () => {
    expect(
      sectionFieldErrors(section, {
        variation: '',
        qualityAssurance: ' ',
        hasSourceDataIssues: '',
        sourceDataIssuesDetail: '',
      }),
    ).toEqual({
      variation: 'Enter how the indicator varies',
      qualityAssurance: 'Enter what quality assurance has been done on the indicator',
      hasSourceDataIssues: 'Select whether there are any data quality issues with the source data',
    });
  });

  it('asks for the details of source data issues, blank ones included', () => {
    expect(
      sectionFieldErrors(section, {
        ...answered,
        hasSourceDataIssues: 'yes',
        sourceDataIssuesDetail: ' \n',
      }),
    ).toEqual({
      sourceDataIssuesDetail: 'Enter details of the data quality issues with the source data',
    });
  });

  it('asks for missing details beside an unanswered question', () => {
    expect(
      sectionFieldErrors(section, { ...answered, variation: '', hasSourceDataIssues: 'yes' }),
    ).toEqual({
      variation: 'Enter how the indicator varies',
      sourceDataIssuesDetail: 'Enter details of the data quality issues with the source data',
    });
  });

  it.each([
    null,
    {},
    { ...answered, hasSourceDataIssues: 'not-applicable' },
    { ...answered, hasSourceDataIssues: true },
    { ...answered, variation: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});
