const NOTE_MARKERS = ['*', '**', '***', '****'];

/** The footnote marker for a value note: sequential by first appearance, `*` beyond the fourth. */
export function noteMarker(noteTexts: readonly string[], text: string): string {
  return NOTE_MARKERS[noteTexts.indexOf(text)] ?? '*';
}

/** The distinct value notes listed once under a table, each behind its marker. */
export function NoteFootnotes({ noteTexts }: { noteTexts: readonly string[] }) {
  return noteTexts.map((text) => (
    <p className="govuk-body-s" key={text}>
      {noteMarker(noteTexts, text)} {text}
    </p>
  ));
}
