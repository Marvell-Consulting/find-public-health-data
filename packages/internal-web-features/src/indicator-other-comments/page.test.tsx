// @vitest-environment jsdom
import { serviceName } from '@fphd/ui';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { OtherCommentsPage } from './page.tsx';

afterEach(cleanup);

const empty = { sponsorsAndStakeholders: '', hasReviewerComments: '', reviewerCommentsDetail: '' };

const SPONSORS = 'Enter any applicable sponsors or stakeholders for this indicator (optional)';
const COMMENTS = 'Are there any other comments for the reviewers?';

// The error summary's links read router state, so the page renders inside a router.
function renderPage(props: Partial<Parameters<typeof OtherCommentsPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <OtherCommentsPage values={empty} {...props} />
    </MemoryRouter>,
  );
}

function sponsors() {
  return screen.getByLabelText(SPONSORS) as HTMLTextAreaElement;
}

function comments() {
  return within(screen.getByRole('group', { name: COMMENTS }));
}

describe('OtherCommentsPage', () => {
  it('asks for the sponsors and stakeholders, then whether there are comments', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Other comments' })).toBeTruthy();
    expect(sponsors().name).toBe('sponsorsAndStakeholders');
    expect(sponsors().getAttribute('rows')).toBe('5');
    expect(screen.getByRole('heading', { level: 2, name: COMMENTS })).toBeTruthy();
    expect(
      (comments().getAllByRole('radio') as HTMLInputElement[]).map((radio) => [
        radio.name,
        radio.value,
      ]),
    ).toEqual([
      ['hasReviewerComments', 'yes'],
      ['hasReviewerComments', 'no'],
    ]);
  });

  it('asks for the comments under Yes', () => {
    renderPage();

    const detail = comments().getByLabelText('Enter comments') as HTMLTextAreaElement;

    expect(detail.name).toBe('reviewerCommentsDetail');
    expect(detail.getAttribute('rows')).toBe('5');
    expect(detail.closest('.govuk-radios__conditional')?.id).toBe(
      comments().getByLabelText('Yes').getAttribute('aria-controls'),
    );
  });

  it('shows the answers it is given, so a draft can be revisited', () => {
    renderPage({
      values: {
        sponsorsAndStakeholders: 'The committee.',
        hasReviewerComments: 'yes',
        reviewerCommentsDetail: 'Replaces 108.',
      },
    });

    expect(sponsors().value).toBe('The committee.');
    expect((comments().getByLabelText('Yes') as HTMLInputElement).checked).toBe(true);
    expect((comments().getByLabelText('Enter comments') as HTMLTextAreaElement).value).toBe(
      'Replaces 108.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe(`Other comments - ${serviceName} - GOV.UK`);
  });

  it('summarises every refusal in the order the form asks, linking to each control', () => {
    renderPage({
      fieldErrors: {
        reviewerCommentsDetail: 'Enter your comments',
        hasReviewerComments: 'Select whether you have additional comments',
      },
      values: { ...empty, hasReviewerComments: 'yes' },
    });

    const links = within(screen.getByRole('alert')).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Select whether you have additional comments',
      'Enter your comments',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${comments().getByLabelText('Yes').id}`,
      `#${comments().getByLabelText('Enter comments').id}`,
    ]);
    expect(document.title).toBe(`Error: Other comments - ${serviceName} - GOV.UK`);
  });
});
