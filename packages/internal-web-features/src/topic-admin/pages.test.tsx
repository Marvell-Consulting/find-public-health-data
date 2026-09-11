// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DeleteTopicPage } from './pages';
import { editTopicPath } from './paths';

afterEach(cleanup);

const topic = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  slug: 'smoking',
  createdAt: '2026-08-01T09:30:00.000Z',
  title: 'Smoking',
  updatedAt: '2026-09-01T09:30:00.000Z',
};

// The page's links and back link read router state, so it renders inside a router.
function renderPage() {
  return render(
    <MemoryRouter>
      <DeleteTopicPage topic={topic} />
    </MemoryRouter>,
  );
}

describe('DeleteTopicPage', () => {
  it('names the topic being deleted and warns it cannot be undone', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Delete topic' })).toBeTruthy();
    expect(screen.getByText('Smoking', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy();
  });

  it('confirms with a warning button in a plain form', () => {
    renderPage();

    const button = screen.getByRole('button', { name: 'Delete topic' });

    expect(button.className).toContain('govuk-button--warning');
    expect(button.closest('form')?.getAttribute('method')).toBe('post');
  });

  it('offers a way back to editing the topic', () => {
    renderPage();

    for (const name of ['Back to editing', 'Cancel']) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(editTopicPath(topic.id));
    }
  });
});
