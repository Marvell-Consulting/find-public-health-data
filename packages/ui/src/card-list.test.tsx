import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { CardList } from './card-list';

afterEach(cleanup);

const items = [
  { href: '/topics/smoking', title: 'Smoking', description: 'Prevalence and quitting.' },
  { href: '/topics/obesity', title: 'Obesity' },
];

// The card link is a router-aware anchor, so it needs a router around it.
function renderCards(props: Omit<ComponentProps<typeof CardList>, 'items'> = {}) {
  return render(
    <MemoryRouter>
      <CardList {...props} items={items} />
    </MemoryRouter>,
  );
}

describe('CardList', () => {
  it('links each card title to its page', () => {
    renderCards();

    expect(screen.getByRole('link', { name: 'Smoking' }).getAttribute('href')).toBe(
      '/topics/smoking',
    );
    expect(screen.getByRole('link', { name: 'Obesity' }).getAttribute('href')).toBe(
      '/topics/obesity',
    );
  });

  it('shows a description only for cards that have one', () => {
    renderCards();

    expect(screen.getByText('Prevalence and quitting.')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('paragraph')).toHaveLength(1);
  });

  it('renders card titles at the heading level the page asks for', () => {
    renderCards({ headingLevel: 2 });

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
