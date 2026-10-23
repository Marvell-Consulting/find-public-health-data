import type { GeographyOptions } from '../geography/loader.ts';
import { GeographyPicker } from '../geography/picker.tsx';
import { LIST_PARAMS, PERIOD_PARAMS, type SearchState } from './url.ts';

export function SearchGeographyPicker({
  action = '/search',
  extraParams = {},
  state,
  displayGroups,
  geographyOptions,
  onApply,
}: {
  action?: string;
  extraParams?: Record<string, string>;
  state: SearchState;
  displayGroups: string[];
  geographyOptions?: GeographyOptions | undefined;
  onApply: (next: SearchState) => void;
}) {
  return (
    <GeographyPicker
      action={action}
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
      {Object.entries(extraParams).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {state.q ? <input name="q" type="hidden" value={state.q} /> : null}
      {PERIOD_PARAMS.map((name) =>
        state[name] ? <input key={name} name={name} type="hidden" value={state[name]} /> : null,
      )}
      {LIST_PARAMS.filter(({ param }) => param !== 'ga' && param !== 'geo').flatMap(
        ({ param, stateKey }) =>
          (state[stateKey] as string[]).map((value) => (
            <input key={`${param}-${value}`} name={param} type="hidden" value={value} />
          )),
      )}
    </GeographyPicker>
  );
}
