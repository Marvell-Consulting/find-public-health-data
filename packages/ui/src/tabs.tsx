import { type ReactNode, useEffect, useState } from 'react';

export interface TabDefinition {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * The GOV.UK Tabs pattern, implemented in React rather than by loading govuk-frontend's
 * JavaScript. The markup, roles and hash-linked ids match the published component, so the
 * behaviour is the familiar one: every panel is a real anchor target, and with JavaScript
 * unavailable the tabs degrade to a list of links over stacked, all-visible panels.
 */
export function Tabs({ label, tabs }: { label: string; tabs: TabDefinition[] }) {
  const firstId = tabs[0]?.id;
  const [selected, setSelected] = useState(firstId);
  // Rendered server-side without JavaScript, every panel shows; once hydrated the
  // component takes over and shows one at a time.
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    setEnhanced(true);

    const fromHash = window.location.hash.slice(1);
    if (tabs.some((tab) => tab.id === fromHash)) {
      setSelected(fromHash);
    }
  }, [tabs]);

  return (
    <div className="govuk-tabs fphd-tabs" data-module="govuk-tabs">
      <h2 className="govuk-tabs__title">{label}</h2>
      <ul className="govuk-tabs__list" role="tablist">
        {tabs.map((tab) => {
          const isSelected = enhanced && tab.id === selected;
          return (
            <li
              className={`govuk-tabs__list-item${isSelected ? ' govuk-tabs__list-item--selected' : ''}`}
              key={tab.id}
              role="presentation"
            >
              <a
                aria-controls={tab.id}
                aria-selected={isSelected}
                className="govuk-tabs__tab"
                href={`#${tab.id}`}
                id={`tab_${tab.id}`}
                onClick={(event) => {
                  // Let the hash change record the tab, but keep the page where it is:
                  // jumping to the panel would scroll the heading out of view.
                  event.preventDefault();
                  setSelected(tab.id);
                  window.history.replaceState(null, '', `#${tab.id}`);
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
              >
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
      {tabs.map((tab) => (
        <div
          aria-labelledby={`tab_${tab.id}`}
          className={`govuk-tabs__panel${enhanced && tab.id !== selected ? ' govuk-tabs__panel--hidden' : ''}`}
          id={tab.id}
          key={tab.id}
          role="tabpanel"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
