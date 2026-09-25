// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { VarianceAndQualityPage } from './page.tsx';

afterEach(cleanup);

const empty = {
  variation: '',
  qualityAssurance: '',
  sourceDataIssues: '',
  sourceDataIssuesDetail: '',
};

const VARIATION = 'How does the indicator vary?';
const QUALITY_ASSURANCE = 'What quality assurance has been done on the indicator?';
const SOURCE_DATA_ISSUES = 'Are there any data quality issues with the source data?';
const DETAILS =
  'Enter details, including what is being done to improve the quality of the source data';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof VarianceAndQualityPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <VarianceAndQualityPage values={empty} {...props} />
    </MemoryRouter>,
  );
}

function textarea(label: string) {
  return screen.getByLabelText(label) as HTMLTextAreaElement;
}

function sourceDataIssues() {
  return within(screen.getByRole('group', { name: SOURCE_DATA_ISSUES }));
}

describe('VarianceAndQualityPage', () => {
  it('asks two questions in text, then whether the source data has issues', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Variance and quality' })).toBeTruthy();
    expect([textarea(VARIATION), textarea(QUALITY_ASSURANCE)].map((field) => field.name)).toEqual([
      'variation',
      'qualityAssurance',
    ]);
    expect(textarea(VARIATION).getAttribute('rows')).toBe('5');
    expect(
      (sourceDataIssues().getAllByRole('radio') as HTMLInputElement[]).map((radio) => [
        radio.name,
        radio.value,
      ]),
    ).toEqual([
      ['sourceDataIssues', 'yes'],
      ['sourceDataIssues', 'no'],
    ]);
    expect(screen.getByRole('heading', { level: 2, name: SOURCE_DATA_ISSUES })).toBeTruthy();
  });

  it('asks for the details of the source data issues under Yes', () => {
    renderPage();

    const details = sourceDataIssues().getByLabelText(DETAILS) as HTMLTextAreaElement;

    expect(details.name).toBe('sourceDataIssuesDetail');
    expect(details.getAttribute('rows')).toBe('5');
    expect(details.closest('.govuk-radios__conditional')?.id).toBe(
      sourceDataIssues().getByLabelText('Yes').getAttribute('aria-controls'),
    );
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        variation: 'Varies by area.',
        qualityAssurance: 'Checked.',
        sourceDataIssues: 'yes',
        sourceDataIssuesDetail: 'Late returns.',
      },
    });

    expect(textarea(VARIATION).value).toBe('Varies by area.');
    expect(textarea(QUALITY_ASSURANCE).value).toBe('Checked.');
    expect((sourceDataIssues().getByLabelText('Yes') as HTMLInputElement).checked).toBe(true);
    expect((sourceDataIssues().getByLabelText(DETAILS) as HTMLTextAreaElement).value).toBe(
      'Late returns.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe(`Variance and quality - ${serviceName} - GOV.UK`);
  });

  it('summarises every refusal in the order the form asks, linking to each control', () => {
    renderPage({
      fieldErrors: {
        sourceDataIssues: 'Select whether there are any data quality issues with the source data',
        variation: 'Enter how the indicator varies',
      },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Enter how the indicator varies',
      'Select whether there are any data quality issues with the source data',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${textarea(VARIATION).id}`,
      `#${sourceDataIssues().getByLabelText('Yes').id}`,
    ]);
    expect(textarea(VARIATION).className).toContain('govuk-textarea--error');
    expect(document.title).toBe(`Error: Variance and quality - ${serviceName} - GOV.UK`);
  });

  it('links a missing detail to its field', () => {
    renderPage({
      fieldErrors: {
        sourceDataIssuesDetail: 'Enter details of the data quality issues with the source data',
      },
      values: { ...empty, sourceDataIssues: 'yes' },
    });

    expect(within(screen.getByRole('alert')).getByRole('link').getAttribute('href')).toBe(
      `#${sourceDataIssues().getByLabelText(DETAILS).id}`,
    );
  });
});
