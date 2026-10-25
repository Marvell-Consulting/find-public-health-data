import { Button, Checkboxes } from '@fphd/ui';
import { useState } from 'react';
import { Form, useNavigate } from 'react-router';
import { HiddenFilters } from '../search/filter-fields.tsx';
import { type SearchState, searchUrl } from '../search/url.ts';

export function TopicSubtopicFilter({
  path,
  state,
  subtopics,
  sort,
}: {
  path: string;
  state: SearchState;
  subtopics: { slug: string; title: string }[];
  sort: string;
}) {
  const [selected, setSelected] = useState(state.subtopics ?? []);
  const navigate = useNavigate();
  const extraParams = { 'tab-topic': 'data', sort };
  if (subtopics.length === 0) return null;
  return (
    <Form action={path} method="get" preventScrollReset>
      <HiddenFilters state={state} except="subtopics" extraParams={extraParams} />
      <Checkboxes
        id="topic-subtopic"
        label="Subtopics"
        name="subtopic"
        options={subtopics.map(({ slug, title }) => ({
          value: slug,
          label: title,
          checked: selected.includes(slug),
        }))}
        onChange={(event) => {
          const { checked, value } = event.target;
          const next = checked ? [...selected, value] : selected.filter((slug) => slug !== value);
          setSelected(next);
          void navigate(searchUrl({ ...state, subtopics: next }, path, extraParams), {
            preventScrollReset: true,
          });
        }}
      />
      <noscript>
        <Button type="submit">Apply subtopics</Button>
      </noscript>
    </Form>
  );
}
