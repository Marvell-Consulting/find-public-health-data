import { expect, type Page } from '@playwright/test';

/** A one-row table for England, which the check page accepts. */
const DATA_TABLE = [
  'area_code,period_start,period_end,value',
  'E92000001,2019-04-01,2020-03-31,83.8',
].join('\n');

/** The value of the option the page's `label` control offers as `text`, or its first real one. */
async function optionValue(page: Page, label: string, text?: string) {
  const select = page.getByLabel(label, { exact: true });
  const option =
    text === undefined
      ? select.locator('option:not([value=""])').first()
      : select.getByRole('option', { name: text, exact: true });
  const value = await option.getAttribute('value');
  if (value === null) throw new Error(`no ${text ?? 'option'} under ${label} on ${page.url()}`);
  return value;
}

/** Posts a page's form as its Continue button does and expects the page to accept it. */
async function post(page: Page, path: string, form: Record<string, string>, next: string) {
  const response = await page.request.post(path, { form, maxRedirects: 0 });
  expect(response.headers().location, `${path} refused its answers`).toBe(next);
}

/**
 * Answers every task on a new draft, data table included, so that it may be submitted. Each
 * page's form is posted as its Continue button sends it, as `createDraft` posts the name page.
 */
export async function completeDraft(page: Page, id: string): Promise<void> {
  const base = `/publish/indicators/${id}`;
  const taskList = `${base}/task-list`;
  await page.goto(`${base}/value-type-and-units`);
  const valueType = await optionValue(page, 'Select value type', 'Count');
  const unit = await optionValue(page, 'Select units', 'per 100');
  await page.goto(`${base}/numerator`);
  const provider = await optionValue(page, 'Add a data provider for the numerator');
  await page.goto(`${base}/confidence-intervals`);
  const ciMethod = await optionValue(
    page,
    'Select the confidence interval method used',
    "Byar's method",
  );
  await page.goto(`${base}/tagging`);
  const topic = await optionValue(page, 'Select a topic');
  const indicatorType = await optionValue(page, 'Select an indicator type');
  const source = { 'sources[0].providerId': provider, 'sources[0].sourceId': '' };
  const sections: Record<string, Record<string, string>> = {
    'value-type-and-units': { valueTypeId: valueType, unitId: unit },
    'sex-and-ages': { sexes: 'persons', ageType: 'all' },
    'period-type': { periodType: 'years', yearsYearType: 'calendar' },
    polarity: { polarity: 'lower-is-better' },
    'data-quality': { hasDataQualityIssues: 'no' },
    'definition-and-rationale': { definition: 'A definition.', rationale: 'A rationale.' },
    numerator: { ...source, definition: 'Deaths.' },
    denominator: { ...source, definition: 'Population.' },
    calculation: { methodology: 'A method.', calculatedBy: 'ohid' },
    'confidence-intervals': { ciMethodId: ciMethod, hasCiMethodModifications: 'no' },
    benchmarking: { hasGoalBenchmark: 'no' },
    'other-notes-and-caveats': {
      disclosureControl: 'not-applicable',
      hasRounding: 'no',
      hasCaveats: 'no',
      hasOtherNotes: 'no',
    },
    links: { hasLinks: 'no' },
    tagging: {
      topicIds: topic,
      indicatorTypeIds: indicatorType,
      hasRiskFactor: 'no',
      hasFramework: 'no',
    },
    'copyright-and-data-reuse': { hasCustomCopyright: 'no', hasCustomDataReuse: 'no' },
    'update-frequency': { updateFrequency: 'annually' },
    'publishing-date': {
      'publishingDate[day]': '1',
      'publishingDate[month]': '4',
      'publishingDate[year]': String(new Date().getFullYear() + 1),
      'publishingTime[hour]': '09',
      'publishingTime[minute]': '30',
    },
    'variance-and-quality': {
      variation: 'Little.',
      qualityAssurance: 'Checked.',
      hasSourceDataIssues: 'no',
    },
    justifications: {
      ciMethodJustification: 'Standard.',
      dataSourcesJustification: 'The best available.',
      inequalitiesIncluded: 'Deprivation.',
      hasExclusions: 'no',
      hasAutomation: 'no',
    },
    'other-comments': { hasReviewerComments: 'no' },
  };

  for (const [key, form] of Object.entries(sections)) {
    await post(page, `${base}/${key}`, form, taskList);
  }

  const uploaded = await page.request.post(`${base}/data-table`, {
    multipart: {
      dataTable: { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from(DATA_TABLE) },
    },
    maxRedirects: 0,
  });
  expect(uploaded.headers().location, 'the data table was refused').toBe(
    `${base}/data-table/check`,
  );
  await page.goto(`${base}/data-table/check`);
  const batchId = await page.locator('input[name="batchId"]').getAttribute('value');
  await post(page, `${base}/data-table/check`, { batchId: batchId ?? '' }, taskList);
}
