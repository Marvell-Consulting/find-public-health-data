// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NoteFootnotes, noteMarker } from './note-markers';

afterEach(cleanup);

const noteTexts = ['Provisional', 'Small numbers', 'Revised', 'Estimated', 'Modelled'];

describe('noteMarker', () => {
  it('assigns markers in order of first appearance', () => {
    expect(noteTexts.map((text) => noteMarker(noteTexts, text))).toEqual([
      '*',
      '**',
      '***',
      '****',
      '*',
    ]);
  });
});

describe('NoteFootnotes', () => {
  it('lists each note once behind its marker', () => {
    render(<NoteFootnotes noteTexts={noteTexts.slice(0, 2)} />);

    const footnotes = screen.getAllByRole('paragraph');

    expect(footnotes.map((footnote) => footnote.textContent)).toEqual([
      '* Provisional',
      '** Small numbers',
    ]);
  });

  it('renders nothing when a table has no notes', () => {
    const { container } = render(<NoteFootnotes noteTexts={[]} />);

    expect(container.childElementCount).toBe(0);
  });
});
