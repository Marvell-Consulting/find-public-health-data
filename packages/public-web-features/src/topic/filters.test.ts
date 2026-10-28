import { expect, it } from 'vitest';
import { topicDataKey } from './filters.ts';

it('revalidates server filters while keeping tab and column switches local', () => {
  const base = new URL('http://local/topics/diabetes');
  expect(topicDataKey(new URL('?sort=subtopic-asc&tab-topic=data&columns-topic=count', base))).toBe(
    topicDataKey(base),
  );
  for (const query of ['?subtopic=care', '?it=outcome', '?geo=NHS+regions', '?q=prevalence'])
    expect(topicDataKey(new URL(query, base))).not.toBe(topicDataKey(base));
});
