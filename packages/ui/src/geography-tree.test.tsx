// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeographyTree } from './geography-tree.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GeographyTree', () => {
  it('announces a level while its areas load', () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const { container } = render(
      <GeographyTree
        levels={['Local authorities']}
        name="areas"
        onChange={() => undefined}
        onLevelsChange={() => undefined}
        selected={[]}
        selectedLevels={[]}
      />,
    );

    const status = container.querySelector('p[aria-live="polite"]');
    expect(status?.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Expand Local authorities' }));

    expect(status?.textContent).toBe('Loading Local authorities…');
    expect(status?.className).toContain('govuk-visually-hidden');
  });

  it('keeps the tree visible while a search is pending', () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    render(
      <GeographyTree
        levels={['Local authorities']}
        name="areas"
        onChange={() => undefined}
        onLevelsChange={() => undefined}
        selected={[]}
        selectedLevels={[]}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Add geographies' }), {
      target: { value: 'Manchester' },
    });

    expect(screen.getByText('Local authorities')).toBeTruthy();
    expect(screen.getByText('Finding geographies…').className).toContain('govuk-visually-hidden');
  });
});

it('searches a flat catalogue supplied after the tab loader finishes', () => {
  const props = {
    flat: true,
    levels: ['Local authorities'],
    name: 'areas',
    selected: [],
    selectedLevels: [],
    onChange: () => undefined,
    onLevelsChange: () => undefined,
  };
  const fallback = { query: '', level: '', groups: [], previews: [], error: false };
  const { rerender } = render(<GeographyTree {...props} fallback={fallback} />);
  rerender(
    <GeographyTree
      {...props}
      fallback={{
        ...fallback,
        previews: [{ name: 'Local authorities', areas: [{ code: 'E08000035', name: 'Leeds' }] }],
      }}
    />,
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Add geographies' }), {
    target: { value: 'Leeds' },
  });
  expect(screen.getByRole('checkbox', { name: 'Leeds' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Geography choices' }).getAttribute('tabindex')).toBe(
    '0',
  );
});
