import { Tag } from '@fphd/ui';
import type { RecentTrend } from './data';

export function TrendTag({ trend }: { trend: RecentTrend }) {
  return (
    <Tag classModifiers={trend.tone} className="fphd-trend-tag">
      {trend.direction ? (
        <span
          aria-hidden="true"
          className={`fphd-trend-tag__arrow fphd-trend-tag__arrow--${trend.direction}`}
        />
      ) : null}
      <span className="fphd-trend-tag__text">{trend.label}</span>
    </Tag>
  );
}
