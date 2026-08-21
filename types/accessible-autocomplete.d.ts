// The package ships no types and no exports map; this covers the slice of its API we use.
declare module 'accessible-autocomplete' {
  interface AccessibleAutocompleteOptions<Option> {
    // HTMLElement, but this file also compiles in Node-only packages with no DOM lib.
    element: unknown;
    id: string;
    source: (query: string, populateResults: (results: Option[]) => void) => void;
    name?: string;
    defaultValue?: string;
    minLength?: number;
    onConfirm?: (confirmed: Option | undefined) => void;
    templates?: {
      inputValue?: (selected?: Option) => string;
      suggestion?: (suggestion?: Option) => string;
    };
    tNoResults?: () => string;
    showNoOptionsFound?: boolean;
    displayMenu?: 'inline' | 'overlay';
  }
  export default function accessibleAutocomplete<Option>(
    options: AccessibleAutocompleteOptions<Option>,
  ): void;
}

declare module 'accessible-autocomplete/dist/accessible-autocomplete.min.css';
