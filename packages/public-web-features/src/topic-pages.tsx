import { A, PageIntro } from '@fphd/ui';

import type { TopicSummary } from './topics-loader';

export function TopicsPage({ topics }: { topics: TopicSummary[] }) {
  return (
    <PageIntro title="Topics">
      <ul className="govuk-list">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <A href={`/topics/${topic.slug}`}>{topic.title}</A>
          </li>
        ))}
      </ul>
    </PageIntro>
  );
}
