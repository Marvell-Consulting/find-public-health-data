// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { CollapsibleFilterCard } from './filter-card';

afterEach(cleanup);

describe('CollapsibleFilterCard', () => {
  it('server renders both the no-script title and enhanced toggle', () => {
    const html = renderToString(
      <CollapsibleFilterCard active={false} title="Topics and types">
        Filters
      </CollapsibleFilterCard>,
    );

    expect(html).toContain('class="fphd-filter-card__title"');
    expect(html).toContain('class="fphd-filter-card__toggle"');
  });

  it('uses standard link styling and toggles the body', () => {
    render(
      <CollapsibleFilterCard active={false} title="Topics and types">
        Filters
      </CollapsibleFilterCard>,
    );

    const toggle = screen.getByRole('button', { name: 'Topics and types Expand' });
    const linkText = screen.getByText('Expand');
    const body = screen.getByText('Filters');

    expect(linkText.classList.contains('govuk-link')).toBe(true);
    expect(body.hidden).toBe(true);

    fireEvent.click(toggle);

    expect(screen.getByText('Collapse')).toBeTruthy();
    expect(body.hidden).toBe(false);
  });
});
