import A from '@not-govuk/link';

export interface CardListItem {
  description?: string;
  href: string;
  title: string;
}

interface CardListProps {
  columns?: 'one' | 'three';
  /** The card titles' heading level, so a page can keep its outline sequential. Appearance is
   * fixed by `govuk-heading-s` and does not follow the level. */
  headingLevel?: 2 | 3;
  items: readonly CardListItem[];
}

/**
 * The whole card is clickable: the link's ::after covers the wrapper. Anything else placed in a
 * card would sit under that overlay, so a card holds only its heading link and description.
 */
export function CardList({ columns = 'one', headingLevel = 3, items }: CardListProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <ul className={`fphd-card-list fphd-card-list--${columns}-column`}>
      {items.map((item) => (
        <li className="fphd-card-list__item" key={item.href}>
          <div className="fphd-card-list__item-wrapper">
            <Heading className="govuk-heading-s fphd-card-list__heading">
              <A className="fphd-card-list__link" href={item.href}>
                {item.title}
              </A>
            </Heading>
            {item.description ? (
              <p className="govuk-body fphd-card-list__description">{item.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
