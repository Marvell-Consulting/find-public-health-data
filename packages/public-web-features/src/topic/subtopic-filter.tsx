import { Button, Checkboxes } from '@fphd/ui';
import { useState } from 'react';
import { Form, useLocation, useNavigate } from 'react-router';
import { HiddenFilters } from '../search/filter-fields.tsx';
import { type SearchState, searchUrl } from '../search/url.ts';

export function TopicSubtopicFilter({
  path,
  state,
  subtopics,
  sort,
  tab = 'data',
}: {
  path: string;
  state: SearchState;
  subtopics: { slug: string; title: string }[];
  sort: string;
  tab?: 'data' | 'areas';
}) {
  const [selected, setSelected] = useState(state.subtopics ?? []);
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const extraParams = {
    ...Object.fromEntries([...params].filter(([key]) => key === 'columns-topic')),
    'tab-topic': tab,
    sort,
  };
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
