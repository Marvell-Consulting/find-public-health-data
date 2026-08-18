import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * The GOV.UK tabs pattern, selected-tab-aware of the URL hash: a filter change reloads
 * the page with the hash intact, so the tab a user was reading stays open instead of
 * snapping back to the first one.
 */
export function Tabs({ items, title = 'Contents' }: { items: TabItem[]; title?: string }) {
  const [selected, setSelected] = useState(0);
  const [mounted, setMounted] = useState(false);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    const fromHash = items.findIndex(({ id }) => window.location.hash === `#${id}`);
    if (fromHash > 0) {
      setSelected(fromHash);
    }
  }, []);

  const focusTab = (index: number) => {
    setSelected(index);
    const anchor = refs.current[index];
    anchor?.focus();
    if (anchor) {
      window.history.replaceState(null, '', `#${items[index]?.id}`);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === 'ArrowLeft' && selected > 0) {
      event.preventDefault();
      focusTab(selected - 1);
    }
    if (event.key === 'ArrowRight' && selected < items.length - 1) {
      event.preventDefault();
      focusTab(selected + 1);
    }
  };

  return (
    <div className="govuk-tabs" data-module="">
      <h2 className="govuk-tabs__title">{title}</h2>
      {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the ARIA tabs
          pattern (and govuk-frontend's own markup) puts role=tablist on the list. */}
      <ul className="govuk-tabs__list" role="tablist">
        {items.map(({ id, label }, index) => (
          <li
            className={`govuk-tabs__list-item${index === selected ? ' govuk-tabs__list-item--selected' : ''}`}
            key={id}
            role="presentation"
          >
            <a
              aria-controls={id}
              aria-selected={index === selected}
              className="govuk-tabs__tab"
              href={`#${id}`}
              id={`tab_${id}`}
              onClick={() => setSelected(index)}
              onKeyDown={onKeyDown}
              ref={(el) => {
                refs.current[index] = el;
              }}
              role="tab"
              tabIndex={mounted ? (index === selected ? 0 : -1) : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      {items.map(({ content, id }, index) => (
        <div
          aria-labelledby={`tab_${id}`}
          className={`govuk-tabs__panel${mounted && index !== selected ? ' govuk-tabs__panel--hidden' : ''}`}
          id={id}
          key={id}
          role="tabpanel"
        >
          {content}
        </div>
      ))}
    </div>
  );
}
