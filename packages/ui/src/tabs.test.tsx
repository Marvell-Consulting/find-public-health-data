// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, type LoaderFunction, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { Tabs } from './tabs.tsx';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

function renderTabs(waitForNavigation = false, loader?: LoaderFunction) {
  const router = createMemoryRouter([
    {
      path: '/',
      ...(loader ? { loader } : {}),
      element: (
        <Tabs
          waitForNavigation={waitForNavigation}
          paramKey="panel"
          items={[
            { id: 'first', param: 'first', label: 'First', content: 'First panel' },
            { id: 'second', param: 'second', label: 'Second', content: 'Second panel' },
          ]}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return router;
}

it('follows a tab parameter changed by another page control', async () => {
  const router = renderTabs();
  await act(async () => {
    await router.navigate('/?panel=second');
  });
  expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
  await act(async () => {
    await router.navigate('/');
  });
  expect(screen.getByRole('tab', { name: 'First' }).getAttribute('aria-selected')).toBe('true');
});

it('preserves a legacy hash selection on hydration', () => {
  window.history.replaceState({}, '', '/#second');
  renderTabs();
  expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
});

it('keeps the current panel visible until the requested tab data arrives', async () => {
  let finish: (value: null) => void = () => {};
  const loaded = new Promise<null>((resolve) => {
    finish = resolve;
  });
  renderTabs(true, ({ request }) =>
    new URL(request.url).searchParams.get('panel') === 'second' ? loaded : null,
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'Second' }));
  expect(screen.getByRole('tab', { name: 'First' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel', { name: 'First' }).className).not.toContain(
    'govuk-tabs__panel--hidden',
  );
  await act(async () => {
    finish(null);
  });
  expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
});

it('uses navigation links for tabs that need loader data without JavaScript', async () => {
  renderTabs(true);
  expect((await screen.findByRole('tab', { name: 'Second' })).getAttribute('href')).toBe(
    '?panel=second#second',
  );
});
