import type { GeographyOptions } from '../geography/loader.ts';
import { GeographyPicker } from '../geography/picker.tsx';
import { LIST_PARAMS, type SearchState } from './url.ts';

export function SearchGeographyPicker({
  state,
  displayGroups,
  geographyOptions,
  onApply,
}: {
  state: SearchState;
  displayGroups: string[];
  geographyOptions?: GeographyOptions | undefined;
  onApply: (next: SearchState) => void;
}) {
  return (
    <GeographyPicker
      action="/search"
      buttonClassName="govuk-!-margin-bottom-0 fphd-button--full-width fphd-add-geo-button"
      displayGroups={displayGroups}
      geographyOptions={geographyOptions}
      levelName="geo"
      name="ga"
      onApply={({ areaCodes, areaLevels }) =>
        onApply({ ...state, gaCodes: areaCodes, geoLevels: areaLevels })
      }
      replace
      selection={{ areaCodes: state.gaCodes, areaLevels: state.geoLevels }}
    >
      {state.q ? <input name="q" type="hidden" value={state.q} /> : null}
      {LIST_PARAMS.filter(({ param }) => param !== 'ga' && param !== 'geo').flatMap(
        ({ param, stateKey }) =>
          (state[stateKey] as string[]).map((value) => (
            <input key={`${param}-${value}`} name={param} type="hidden" value={value} />
          )),
      )}
    </GeographyPicker>
  );
}
