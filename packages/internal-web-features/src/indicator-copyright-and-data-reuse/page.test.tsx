// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { noRefusal } from '../testing.ts';
import { CopyrightAndDataReusePage } from './page.tsx';

afterEach(cleanup);

const empty = {
  hasCustomCopyright: '',
  customCopyrightDetail: '',
  hasCustomDataReuse: '',
  customDataReuseDetail: '',
};

const COPYRIGHT = 'Is the copyright different to the default?';
const DATA_REUSE = 'Is the data re-use different to the default?';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof CopyrightAndDataReusePage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <CopyrightAndDataReusePage {...noRefusal} values={empty} {...props} />
    </MemoryRouter>,
  );
}

function question(legend: string) {
  return within(screen.getByRole('group', { name: legend }));
}

function details(legend: string) {
  return question(legend).getByLabelText('Provide details') as HTMLTextAreaElement;
}

describe('CopyrightAndDataReusePage', () => {
  it('asks whether the copyright, then the data re-use, differ from the defaults', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Copyright and data re-use' }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([COPYRIGHT, DATA_REUSE]);
    expect(
      (screen.getAllByRole('radio') as HTMLInputElement[]).map((radio) => [
        radio.name,
        radio.value,
      ]),
    ).toEqual([
      ['hasCustomCopyright', 'yes'],
      ['hasCustomCopyright', 'no'],
      ['hasCustomDataReuse', 'yes'],
      ['hasCustomDataReuse', 'no'],
    ]);
  });

  it('names each default in the hint to its question', () => {
    renderPage();

    expect(question(COPYRIGHT).getByText('The default is "© Crown copyright"')).toBeTruthy();
    expect(
      question(DATA_REUSE).getByText(
        'The default is "The data may be used referencing Office for Health Improvement and Disparities"',
      ),
    ).toBeTruthy();
  });

  it.each([
    [COPYRIGHT, 'customCopyrightDetail'],
    [DATA_REUSE, 'customDataReuseDetail'],
  ])('asks for the details under Yes to "%s"', (legend, name) => {
    renderPage();

    expect(details(legend).name).toBe(name);
    expect(details(legend).getAttribute('rows')).toBe('2');
    expect(details(legend).closest('.govuk-radios__conditional')?.id).toBe(
      question(legend).getByLabelText('Yes').getAttribute('aria-controls'),
    );
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        hasCustomCopyright: 'yes',
        customCopyrightDetail: 'Copyright © NHS England',
        hasCustomDataReuse: 'no',
        customDataReuseDetail: '',
      },
    });

    expect((question(COPYRIGHT).getByLabelText('Yes') as HTMLInputElement).checked).toBe(true);
    expect(details(COPYRIGHT).value).toBe('Copyright © NHS England');
    expect((question(DATA_REUSE).getByLabelText('No') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe(`Copyright and data re-use - ${serviceName} - GOV.UK`);
  });

  it('links each refusal to its control, in the order the form asks', () => {
    renderPage({
      fieldErrors: {
        hasCustomDataReuse: 'Select whether the data re-use is different to the default',
        customCopyrightDetail: 'Provide details of the copyright',
      },
      values: { ...empty, hasCustomCopyright: 'yes' },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Provide details of the copyright',
      'Select whether the data re-use is different to the default',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${details(COPYRIGHT).id}`,
      `#${question(DATA_REUSE).getByLabelText('Yes').id}`,
    ]);
  });
});
