import 'accessible-autocomplete/dist/accessible-autocomplete.min.css';

import { useEffect, useId, useRef, useState } from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteProps {
  label: string;
  onSelect: (option: AutocompleteOption) => void;
  /**
   * Asked for suggestions once typing pauses; the signal aborts a request the next
   * keystroke has made stale.
   */
  source: (query: string, signal: AbortSignal) => Promise<AutocompleteOption[]>;
  /** Submitted with the parent form, so the input works as a plain search field too. */
  name: string;
  defaultValue?: string;
  /** Most suggestions worth showing at once; the rest stay behind a narrower query. */
  limit?: number;
}

// Long enough to spare the server a request per keystroke, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 300;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GOV.UK's accessible-autocomplete over a server-side search, as an enhancement: the
 * server renders a real search input that submits with its parent form, and the library
 * replaces it on mount, keeping the same id and name so the label and the form keep
 * working. Without JavaScript the plain input remains and the form round-trips the
 * search to the server. The library owns the combobox behaviour, the "No results found"
 * message and the assistive-technology status announcements; this wrapper adds the
 * debounce its async source is expected to bring. Its bundle touches `self` at module
 * scope, so it is imported only in the browser.
 */
export function Autocomplete({
  label,
  onSelect,
  source,
  name,
  defaultValue = '',
  limit = 10,
}: AutocompleteProps) {
  // The library builds its own input carrying this id; colons would break the CSS
  // selectors it uses internally.
  const inputId = `fphd-autocomplete-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  // Kept current so the mount-once effect never holds stale props.
  const callbacks = useRef({ onSelect, source });
  callbacks.current = { onSelect, source };
  // Init-only: a later defaultValue (a fresh search submit) must not tear down the live
  // widget, which would blank the menu and drop focus mid-interaction.
  const initialValue = useRef(defaultValue);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    // The library has no in-flight state: with an empty option list it shows tNoResults
    // even while a search is running. Tracking the request here keeps that message
    // truthful — "Loading results" until the response says there are none.
    let searching = false;
    let failed = false;
    const cancelPending = () => {
      clearTimeout(timer);
      controller?.abort();
      searching = false;
    };
    // The library stops calling source below minLength and on blur, so a debounced
    // request scheduled just before either would still land and reopen the menu with
    // results for text the user has deleted or left behind.
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.value.trim().length < 2) {
        cancelPending();
      }
    };
    const onFocusOut = () => cancelPending();
    // With nothing highlighted the library preventDefaults Enter without confirming
    // anything, which would strand keyboard users unable to submit the surrounding
    // search form. Stopping propagation before the library sees the key lets the
    // browser's implicit form submission run instead; a highlighted option keeps the
    // library's confirm behaviour.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !container.querySelector('.autocomplete__option--focused')) {
        event.stopPropagation();
      }
    };
    container.addEventListener('input', onInput);
    container.addEventListener('focusout', onFocusOut);
    container.addEventListener('keydown', onKeyDown, true);

    void import('accessible-autocomplete').then(({ default: accessibleAutocomplete }) => {
      if (unmounted) {
        return;
      }
      accessibleAutocomplete<AutocompleteOption>({
        element: container,
        id: inputId,
        name,
        defaultValue: initialValue.current,
        minLength: 2,
        // Blurring with a suggestion merely highlighted must not confirm it: confirming
        // navigates and adds the indicator, which a click elsewhere never intends.
        confirmOnBlur: false,
        source: (query, populateResults) => {
          clearTimeout(timer);
          controller?.abort();
          const own = new AbortController();
          controller = own;
          searching = true;
          failed = false;
          timer = setTimeout(() => {
            void callbacks.current.source(query.trim(), own.signal).then(
              (results) => {
                if (!own.signal.aborted) {
                  searching = false;
                  populateResults(results.slice(0, limit));
                }
              },
              () => {
                // An aborted request belongs to a newer keystroke, which now owns the
                // menu. A real failure must not read as "no such indicator".
                if (!own.signal.aborted) {
                  searching = false;
                  failed = true;
                  populateResults([]);
                }
              },
            );
          }, SEARCH_DEBOUNCE_MS);
        },
        templates: {
          // Suggestion templates are injected as HTML; names are data, not markup. The
          // picked name stays in the field, so the choice remains visible while the
          // confirm step (the Add indicator button) is still to come.
          suggestion: (option) => (option ? escapeHtml(option.label) : ''),
          inputValue: (option) => option?.label ?? '',
        },
        onConfirm: (option) => {
          if (option) {
            callbacks.current.onSelect(option);
          }
        },
        tNoResults: () =>
          searching
            ? 'Loading results'
            : failed
              ? 'Search is not working right now — try again'
              : 'No indicators found',
        tStatusNoResults: () =>
          searching
            ? 'Loading results'
            : failed
              ? 'Search is not working right now — try again'
              : 'No indicators found',
      });
      // Swapping state after the library has rendered means an input is always on the
      // page: the fallback leaves in the same paint its replacement arrives in.
      setEnhanced(true);
    });

    return () => {
      unmounted = true;
      cancelPending();
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusout', onFocusOut);
      container.removeEventListener('keydown', onKeyDown, true);
      container.innerHTML = '';
    };
  }, [inputId, name, limit]);

  return (
    <div className="govuk-form-group fphd-autocomplete">
      <label className="govuk-label govuk-!-font-weight-bold" htmlFor={inputId}>
        {label}
      </label>
      <div ref={containerRef} />
      {enhanced ? null : (
        <input
          className="govuk-input"
          defaultValue={defaultValue}
          id={inputId}
          name={name}
          type="search"
        />
      )}
    </div>
  );
}
