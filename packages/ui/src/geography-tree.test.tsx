// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeographyTree } from './geography-tree';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GeographyTree', () => {
  it('announces a level while its areas load', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Expand Local authorities' }));

    expect(screen.getByText('Loading Local authorities…').getAttribute('role')).toBe('status');
  });
});
