import A from '@not-govuk/link';

export interface CardListItem {
  description: string;
  href: string;
  title: string;
}

/**
 * The whole card is clickable: the link's ::after covers the wrapper. Anything else placed in a
 * card would sit under that overlay, so a card holds only its heading link and description.
 */
export function CardList({ items }: { items: readonly CardListItem[] }) {
  return (
    <ul className="fphd-card-list">
      {items.map((item) => (
        <li className="fphd-card-list__item" key={item.href}>
          <div className="fphd-card-list__item-wrapper">
            <h3 className="govuk-heading-s fphd-card-list__heading">
              <A className="fphd-card-list__link" href={item.href}>
                {item.title}
              </A>
            </h3>
            <p className="govuk-body fphd-card-list__description">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
