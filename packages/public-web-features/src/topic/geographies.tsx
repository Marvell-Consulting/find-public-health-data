import { CollapsibleFilterCard, FilterChip, FilterChips } from '@fphd/ui';
import { useNavigate } from 'react-router';
import { SearchGeographyPicker } from '../search/geography-picker.tsx';
import type { loadSearch } from '../search/loader.ts';
import { searchUrl } from '../search/url.ts';

type Search = Awaited<ReturnType<typeof loadSearch>>;

export function TopicGeographies({
  search,
  path,
  tab,
}: {
  search: Search;
  path: string;
  tab: 'overview' | 'areas';
}) {
  const navigate = useNavigate();
  const extraParams = { 'tab-topic': tab };
  const urlFor = (gaCodes: string[], geoLevels: string[]) =>
    searchUrl({ ...search, gaCodes, geoLevels }, path, extraParams);
  const picked = search.gaCodes.length > 0 || search.geoLevels.length > 0;
  return (
    <div className="fphd-topic-geographies">
      <CollapsibleFilterCard
        active
        title="Geographies"
        onClear={picked ? urlFor([], []) : undefined}
        footer={
          <SearchGeographyPicker
            action={path}
            extraParams={extraParams}
            state={search}
            displayGroups={search.displayGroups}
            geographyOptions={search.geographyOptions}
            onApply={({ gaCodes, geoLevels }) =>
              void navigate(urlFor(gaCodes, geoLevels), { preventScrollReset: true })
            }
          />
        }
      >
        <p className="govuk-body-s">Showing figures for</p>
        <FilterChips>
          {!picked ? <FilterChip value="E92000001">England</FilterChip> : null}
          {search.geoLevels.map((level) => (
            <FilterChip
              key={level}
              value={level}
              onRemove={urlFor(
                search.gaCodes,
                search.geoLevels.filter((item) => item !== level),
              )}
              removeLabel={level}
            >
              {level}
            </FilterChip>
          ))}
          {search.gaCodes.map((code) => (
            <FilterChip
              key={code}
              value={code}
              onRemove={urlFor(
                search.gaCodes.filter((item) => item !== code),
                search.geoLevels,
              )}
              removeLabel={search.gaAreaNames[code] ?? code}
            >
              {search.gaAreaNames[code] ?? code}
            </FilterChip>
          ))}
        </FilterChips>
      </CollapsibleFilterCard>
    </div>
  );
}
