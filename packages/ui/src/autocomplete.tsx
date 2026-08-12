import { useId, useRef, useState } from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
  /** Secondary text shown after the label, e.g. the group an area belongs to. */
  hint?: string;
}

interface AutocompleteProps {
  label: string;
  onSelect: (option: AutocompleteOption) => void;
  options: AutocompleteOption[];
  /** Most suggestions worth showing at once; the rest stay behind a narrower query. */
  limit?: number;
}

/**
 * A type-ahead over a list already in memory, following the ARIA combobox pattern the
 * GOV.UK accessible-autocomplete implements. Written here rather than pulled in as a
 * dependency because the whole option set is a prop — there is nothing to fetch, and the
 * component has to render identically on the server.
 */
export function Autocomplete({ label, onSelect, options, limit = 10 }: AutocompleteProps) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? options.filter(({ label: text }) => text.toLowerCase().includes(trimmed)).slice(0, limit)
    : [];

  const choose = (option: AutocompleteOption) => {
    onSelect(option);
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="govuk-form-group fphd-autocomplete">
      <label className="govuk-label govuk-!-font-weight-bold" htmlFor={inputId}>
        {label}
      </label>
      <input
        // Names the highlighted option so assistive technology announces it as the arrow
        // keys move through the list.
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && matches.length > 0}
        autoComplete="off"
        className="govuk-input"
        id={inputId}
        onBlur={() => {
          // A click on a suggestion blurs the input before it fires, so closing waits.
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => clearTimeout(blurTimer.current)}
        onKeyDown={(event) => {
          if (matches.length === 0) {
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((current) => (current + 1) % matches.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((current) => (current <= 0 ? matches.length - 1 : current - 1));
          } else if (event.key === 'Enter') {
            const option = matches[active] ?? matches[0];
            if (option) {
              event.preventDefault();
              choose(option);
            }
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="combobox"
        type="text"
        value={query}
      />
      {open && matches.length > 0 ? (
        <ul className="fphd-autocomplete__menu" id={listId} role="listbox">
          {matches.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled on the combobox input, per the ARIA pattern.
            <li
              aria-selected={index === active}
              className={`fphd-autocomplete__option${index === active ? ' fphd-autocomplete__option--active' : ''}`}
              id={`${listId}-${index}`}
              key={option.value}
              onClick={() => choose(option)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              {option.label}
              {option.hint ? (
                <span className="fphd-autocomplete__group"> ({option.hint})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
