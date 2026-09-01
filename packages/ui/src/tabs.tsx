import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * The GOV.UK tabs pattern, with the open tab kept in a query param of its own
 * (`tab-241=table-241`) rather than the URL hash: several indicators' tab sets coexist
 * on one page, and a single hash cannot remember more than one of them — nor stay out
 * of the browser's scroll handling. The anchors keep their panel hrefs, so without
 * JavaScript the panels stack and the links jump to them.
 */
export function Tabs({
  items,
  paramKey,
  title = 'Contents',
}: {
  items: TabItem[];
  /** The query param carrying this tab set's open panel, e.g. 'tab-241'. */
  paramKey: string;
  title?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  // The param is in the request URL, so the server already renders the right panel
  // selected and hydration sees the same choice.
  const fromParam = new URLSearchParams(location.search).get(paramKey);
  const paramIndex = items.findIndex(({ id }) => id === fromParam);
  const [selected, setSelected] = useState(paramIndex > 0 ? paramIndex : 0);
  const [mounted, setMounted] = useState(false);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    // Legacy links carry the open tab as a #hash, which never reaches the server; it
    // is honoured once here and superseded by the param on the next tab click.
    const fromHash = items.findIndex(({ id }) => window.location.hash === `#${id}`);
    if (fromHash > 0) {
      setSelected(fromHash);
    }
  }, []);

  const choose = (index: number) => {
    setSelected(index);
    const params = new URLSearchParams(location.search);
    const id = items[index]?.id;
    if (index === 0 || !id) {
      // The first tab is the default; a param would only clutter the URL.
      params.delete(paramKey);
    } else {
      params.set(paramKey, id);
    }
    void navigate({ search: `?${params.toString()}` }, { replace: true, preventScrollReset: true });
  };

  const focusTab = (index: number) => {
    choose(index);
    refs.current[index]?.focus();
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
    <div className={`govuk-tabs${mounted ? '' : ' fphd-tabs--ssr'}`} data-module="">
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
              onClick={(event) => {
                // The default would write the hash and scroll the panel into view; the
                // param navigation changes neither the hash nor the scroll position.
                event.preventDefault();
                choose(index);
              }}
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
          className={`govuk-tabs__panel${index === selected ? ' fphd-tabs__panel--open' : ''}${mounted && index !== selected ? ' govuk-tabs__panel--hidden' : ''}`}
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
