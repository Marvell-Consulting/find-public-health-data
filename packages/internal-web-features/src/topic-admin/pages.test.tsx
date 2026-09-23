// @vitest-environment jsdom

import { serviceName } from '@fphd/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DeleteTopicPage, EditTopicPage, NewTopicPage } from './pages.tsx';
import { editTopicPath } from './paths.ts';

afterEach(cleanup);

const topic = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  slug: 'smoking',
  createdAt: '2026-08-01T09:30:00.000Z',
  title: 'Smoking',
  updatedAt: '2026-09-01T09:30:00.000Z',
};

// The page's links read router state, so it renders inside a router.
function renderPage() {
  return render(
    <MemoryRouter>
      <DeleteTopicPage topic={topic} />
    </MemoryRouter>,
  );
}

const values = { title: 'Smoking', slug: 'smoking', description: 'About smoking.' };

describe('NewTopicPage', () => {
  it('titles the document after the page', () => {
    render(
      <MemoryRouter>
        <NewTopicPage />
      </MemoryRouter>,
    );

    expect(document.title).toBe(`Add a topic - ${serviceName} - GOV.UK`);
  });

  it('starts the title with "Error: " when the submission is rejected', () => {
    render(
      <MemoryRouter>
        <NewTopicPage fieldErrors={{ title: 'Enter a topic name' }} values={values} />
      </MemoryRouter>,
    );

    expect(document.title).toBe(`Error: Add a topic - ${serviceName} - GOV.UK`);
  });
});

describe('EditTopicPage', () => {
  it('titles the document after the page', () => {
    render(
      <MemoryRouter>
        <EditTopicPage topicId={topic.id} values={values} />
      </MemoryRouter>,
    );

    expect(document.title).toBe(`Edit topic - ${serviceName} - GOV.UK`);
  });

  it('starts the title with "Error: " when the save is rejected', () => {
    render(
      <MemoryRouter>
        <EditTopicPage
          fieldErrors={{ slug: 'This slug is already used' }}
          topicId={topic.id}
          values={values}
        />
      </MemoryRouter>,
    );

    expect(document.title).toBe(`Error: Edit topic - ${serviceName} - GOV.UK`);
  });
});

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

    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
      editTopicPath(topic.id),
    );
  });
});
