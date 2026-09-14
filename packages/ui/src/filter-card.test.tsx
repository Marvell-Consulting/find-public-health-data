// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { CollapsibleFilterCard } from './filter-card';

afterEach(cleanup);

describe('CollapsibleFilterCard', () => {
  it('server renders the title and enhanced toggle', () => {
    const html = renderToString(
      <CollapsibleFilterCard active={false} title="Topics and types">
        Filters
      </CollapsibleFilterCard>,
    );

    expect(html).toContain('<span>Topics and types</span>');
    expect(html).toContain('class="fphd-filter-card__toggle');
  });

  it('toggles the body', () => {
    render(
      <CollapsibleFilterCard active={false} title="Topics and types">
        Filters
      </CollapsibleFilterCard>,
    );

    const toggle = screen.getByRole('button', { name: 'Topics and types Expand' });
    const body = screen.getByText('Filters');

    expect(body.hidden).toBe(true);

    fireEvent.click(toggle);

    expect(screen.getByText('Collapse')).toBeTruthy();
    expect(body.hidden).toBe(false);
  });
});
