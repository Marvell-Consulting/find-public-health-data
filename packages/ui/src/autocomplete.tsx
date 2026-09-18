import 'accessible-autocomplete/dist/accessible-autocomplete.min.css';

import Input from '@not-govuk/input';
import Label from '@not-govuk/label';
import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export interface AutocompleteOption {
  value: string;
  label: string;
}

type AutocompleteProps = {
  onInputChange?: (value: string) => void;
} & (
  | {
      label: string;
      onSelect: (option: AutocompleteOption) => void;
      /** Fetch-based mode: asked for suggestions once typing pauses; the signal aborts stale requests. */
      source: (query: string, signal: AbortSignal) => Promise<AutocompleteOption[]>;
      options?: never;
      noResultsMessage?: string;
      name?: string;
      defaultValue?: string;
      /** Most suggestions worth showing at once; the rest stay behind a narrower query. */
      limit?: number;
    }
  | {
      label: string;
      onSelect: (option: AutocompleteOption) => void;
      source?: never;
      /** Local options filtered case-insensitively by substring; no fetch, no debounce. */
      options: AutocompleteOption[];
      noResultsMessage?: string;
      name?: string;
      defaultValue?: string;
      limit?: number;
    }
);

const SEARCH_DEBOUNCE_MS = 300;

// The library seeds its option list with the raw defaultValue and offers it on focus, so the
// templates and onConfirm can be handed the typed string as well as an option.
function labelOf(option: AutocompleteOption | string | null | undefined): string {
  return typeof option === 'string' ? option : (option?.label ?? '');
}

function isOption(
  option: AutocompleteOption | string | null | undefined,
): option is AutocompleteOption {
  return (
    typeof option === 'object' &&
    option !== null &&
    typeof option.value === 'string' &&
    typeof option.label === 'string'
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GOV.UK's accessible-autocomplete as an enhancement: the server renders a real search
 * input that submits with its parent form, and the library replaces it on mount, keeping
 * the same id so the label stays attached. Without JavaScript the plain input remains.
 * Suggestions come either from a debounced server `source` or a local `options` list. The
 * library owns the combobox behaviour and the assistive-technology status announcements.
 * Its bundle touches `self` at module scope, so it is imported only in the browser.
 */
export function Autocomplete({
  label,
  onSelect,
  source,
  options,
  noResultsMessage,
  name,
  defaultValue = '',
  limit = 10,
  onInputChange,
}: AutocompleteProps) {
  // Colons from useId would break the CSS selectors the library builds from this id.
  const inputId = `fphd-autocomplete-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  // Kept current so the mount-once effect never holds stale props.
  const callbacks = useRef({ onSelect, source, options, onInputChange });
  callbacks.current = { onSelect, source, options, onInputChange };
  // Init-only: a defaultValue change must not tear down the live widget.
  const initialValue = useRef(defaultValue);
  const isLocalMode = options !== undefined;

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
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      callbacks.current.onInputChange?.(target.value);
      if (!isLocalMode && target.value.trim().length < 2) {
        cancelPending();
      }
    };
    const onFocusOut = () => {
      if (!isLocalMode) cancelPending();
    };
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

      const noResults = noResultsMessage ?? 'No indicators found';

      if (isLocalMode) {
        accessibleAutocomplete<AutocompleteOption>({
          element: container,
          id: inputId,
          ...(name ? { name } : {}),
          defaultValue: initialValue.current,
          minLength: 0,
          showAllValues: true,
          confirmOnBlur: false,
          source: (query, populateResults) => {
            const q = query.trim().toLowerCase();
            const all = callbacks.current.options ?? [];
            const filtered = q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
            populateResults(filtered.slice(0, limit));
          },
          templates: {
            suggestion: (option) => escapeHtml(labelOf(option)),
            inputValue: (option) => labelOf(option),
          },
          onConfirm: (option) => {
            if (isOption(option)) {
              callbacks.current.onSelect(option);
            }
          },
          tNoResults: () => noResults,
          tStatusNoResults: () => noResults,
        });
      } else {
        accessibleAutocomplete<AutocompleteOption>({
          element: container,
          id: inputId,
          ...(name ? { name } : {}),
          defaultValue: initialValue.current,
          minLength: 2,
          confirmOnBlur: false,
          source: (query, populateResults) => {
            clearTimeout(timer);
            controller?.abort();
            const own = new AbortController();
            controller = own;
            searching = true;
            failed = false;
            timer = setTimeout(() => {
              void callbacks.current.source?.(query.trim(), own.signal).then(
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
                : (noResultsMessage ?? 'No indicators found'),
          tStatusNoResults: () =>
            searching
              ? 'Loading results'
              : failed
                ? 'Search is not working right now — try again'
                : (noResultsMessage ?? 'No indicators found'),
        });
      }
    });

    return () => {
      unmounted = true;
      cancelPending();
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusout', onFocusOut);
      container.removeEventListener('keydown', onKeyDown, true);
      container.innerHTML = '';
    };
  }, [inputId, name, limit, isLocalMode, noResultsMessage]);

  return (
    <div className="govuk-form-group fphd-autocomplete">
      <Label classModifiers="s" htmlFor={inputId}>
        {label}
      </Label>
      <div ref={containerRef} />
      {enhanced ? null : (
        <Input defaultValue={defaultValue} id={inputId} name={name} type="search" />
      )}
    </div>
  );
}
