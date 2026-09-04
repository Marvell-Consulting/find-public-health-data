import 'accessible-autocomplete/dist/accessible-autocomplete.min.css';

import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

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
  /** Form field name, for a consumer that wraps the control in a form. */
  name?: string;
  defaultValue?: string;
  /** Most suggestions worth showing at once; the rest stay behind a narrower query. */
  limit?: number;
}

// Long enough to spare the server a request per keystroke, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 300;

// The library seeds its option list with the raw defaultValue and offers it on focus, so the
// templates and onConfirm can be handed the typed string as well as an option.
function labelOf(option: AutocompleteOption | string | null | undefined): string {
  return typeof option === 'string' ? option : (option?.label ?? '');
}

function isOption(
  option: AutocompleteOption | string | null | undefined,
): option is AutocompleteOption {
  return typeof option === 'object' && option !== null;
}

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
 * replaces it on mount, keeping the same id so the label stays attached. Without
 * JavaScript the plain input remains; wiring it to a form is the consumer's choice. The library owns the combobox behaviour, the "No results found"
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
  // Colons from useId would break the CSS selectors the library builds from this id.
  const inputId = `fphd-autocomplete-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  // Kept current so the mount-once effect never holds stale props.
  const callbacks = useRef({ onSelect, source });
  callbacks.current = { onSelect, source };
  // Init-only: a defaultValue change must not tear down the live widget.
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
    // The library stops calling source below minLength and on blur; a pending debounce would still land and reopen the menu.
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.value.trim().length < 2) {
        cancelPending();
      }
    };
    const onFocusOut = () => cancelPending();
    // With nothing highlighted the library swallows Enter; stopping propagation lets
    // the browser's implicit form submission run, while a highlighted option confirms.
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
      // The fallback leaves in the task its replacement renders in: one id, no painted gap.
      flushSync(() => setEnhanced(true));
      accessibleAutocomplete<AutocompleteOption>({
        element: container,
        id: inputId,
        ...(name ? { name } : {}),
        defaultValue: initialValue.current,
        minLength: 2,
        // A merely-highlighted suggestion must not confirm on blur — confirming navigates.
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
                // Aborted means a newer keystroke owns the menu; real failures must not read as empty results.
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
          // Suggestions inject as HTML, so names are escaped; the picked name stays visible for the confirm step.
          suggestion: (option) => escapeHtml(labelOf(option)),
          inputValue: (option) => labelOf(option),
        },
        onConfirm: (option) => {
          if (isOption(option)) {
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
