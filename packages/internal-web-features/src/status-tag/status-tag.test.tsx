// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusTag, type StatusTagProps } from './status-tag.tsx';

afterEach(cleanup);

function tag(label: string) {
  const element = screen.getByText(label);

  expect(element.className).toContain('govuk-tag');
  expect(element.className).toContain('fphd-status-tag');

  return element.className;
}

describe('StatusTag', () => {
  it.each([
    ['new', 'New', 'blue'],
    ['live', 'Live', 'teal'],
  ] as const)('shows an indicator status of %s as %s', (status, label, colour) => {
    render(<StatusTag type="indicator" status={status} />);

    expect(tag(label)).toContain(`govuk-tag--${colour}`);
  });

  it.each([
    ['new', 'draft', 'Incomplete', 'blue'],
    ['live', null, 'Published', 'green'],
    ['live', 'draft', 'Update incomplete', 'blue'],
  ] as const)(
    'shows a %s indicator with a draft status of %s as %s',
    (indicatorStatus, draftStatus, label, colour) => {
      render(
        <StatusTag type="publishing" indicatorStatus={indicatorStatus} draftStatus={draftStatus} />,
      );

      expect(tag(label)).toContain(`govuk-tag--${colour}`);
    },
  );

  it('shows nothing for a new indicator with no draft, which cannot be made', () => {
    const { container } = render(
      <StatusTag type="publishing" indicatorStatus="new" draftStatus={null} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it.each<[string, StatusTagProps, string, string]>([
    ['an indicator', { type: 'indicator', status: 'live' }, 'Indicator status: ', 'Live'],
    [
      'a publishing',
      { type: 'publishing', indicatorStatus: 'live', draftStatus: null },
      'Publishing status: ',
      'Published',
    ],
  ])('names %s status for screen readers only', (_, props, prefix, label) => {
    render(<StatusTag {...props} />);

    const hidden = screen.getByText(prefix.trim());

    expect(hidden.className).toBe('govuk-visually-hidden');
    expect(hidden.parentElement?.textContent).toBe(`${prefix}${label}`);
  });

  it('leaves the name out where something else already gives it', () => {
    render(<StatusTag type="indicator" status="live" labelled={false} />);

    expect(tag('Live')).toBeTruthy();
    expect(document.querySelector('.govuk-visually-hidden')).toBeNull();
  });

  it('does not name a task status, which is read out with its task', () => {
    render(<StatusTag type="task" status="not_started" />);

    expect(document.querySelector('.govuk-visually-hidden')).toBeNull();
  });

  it('shows a task that is not started as a tag', () => {
    render(<StatusTag type="task" status="not_started" />);

    expect(tag('Not started')).toContain('govuk-tag--blue');
  });

  it('shows a completed task as plain text, as GOV.UK does', () => {
    const { container } = render(<StatusTag type="task" status="completed" />);

    expect(container.textContent).toBe('Completed');
    expect(container.querySelector('.govuk-tag')).toBeNull();
  });
});
