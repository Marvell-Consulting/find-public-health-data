import {
  type DataProvider,
  type IndicatorSourcePart,
  NO_SPECIFIC_SOURCE,
  type ProviderSource,
  providerSourceLabel,
} from '@fphd/internal-api-features/contract';
import { Button, fieldInputId, Select, Textarea } from '@fphd/ui';
import { useEffect, useState } from 'react';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import {
  type ProviderSourcesPageField,
  type ProviderSourcesPageValues,
  removeSourceIntent,
  sourceFieldName,
} from './form.ts';

// The order the error summary lists them in, which is the order the page asks.
const FIELDS: readonly ProviderSourcesPageField[] = [
  'sources',
  'providerId',
  'sourceId',
  'definition',
];

/** The sources added so far, each carried in hidden fields until Continue saves it. */
function AddedSources({
  providers,
  sources,
}: {
  providers: readonly DataProvider[];
  sources: readonly ProviderSource[];
}) {
  if (sources.length === 0) return null;

  return (
    <ul className="fphd-added-list govuk-!-margin-bottom-6">
      {sources.map((source, index) => {
        const label = providerSourceLabel(source, providers);

        return (
          <li className="fphd-added-list__item" key={label}>
            <input
              name={sourceFieldName(index, 'providerId')}
              type="hidden"
              value={source.providerId}
            />
            <input
              name={sourceFieldName(index, 'sourceId')}
              type="hidden"
              value={source.sourceId ?? ''}
            />
            <span>{label}</span>
            <Button
              classModifiers="secondary"
              className="govuk-!-margin-bottom-0"
              name="intent"
              value={removeSourceIntent(index)}
            >
              {'Remove '}
              <span className="govuk-visually-hidden">{label}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

interface ProviderSourcesPageProps
  extends SectionPageProps<ProviderSourcesPageField, ProviderSourcesPageValues> {
  part: IndicatorSourcePart;
  providers: readonly DataProvider[];
}

/**
 * The numerator's or denominator's sources and definition. A provider's sources are offered
 * once it is chosen: in the browser as soon as it is, and without JavaScript by Show sources,
 * which sends the form back with the provider chosen.
 */
export function ProviderSourcesPage({
  fieldErrors = {},
  formError,
  part,
  providers,
  values,
}: ProviderSourcesPageProps) {
  const [providerId, setProviderId] = useState(values.providerId);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    // A provider chosen before hydration is in the select but not yet in state.
    const select = document.getElementById(fieldInputId('providerId'));
    if (select instanceof HTMLSelectElement) setProviderId(select.value);
    setEnhanced(true);
  }, []);

  const provider = providers.find(({ id }) => id === providerId);
  // Nothing added yet is asked of the provider select, where the first source is chosen.
  const providerError = fieldErrors.providerId ?? fieldErrors.sources;

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fieldIds={{ sources: fieldInputId('providerId') }}
      fields={FIELDS}
      formError={formError}
      title={`What are the details of the ${part}?`}
    >
      <AddedSources providers={providers} sources={values.sources} />
      <Select
        {...(providerError === undefined ? {} : { error: providerError })}
        defaultValue={values.providerId}
        label={`Add a data provider for the ${part}`}
        name="providerId"
        onChange={(event) => setProviderId(event.target.value)}
        options={[
          { label: 'Select a data provider', value: '' },
          ...providers.map(({ id, name }) => ({ label: name, value: id })),
        ]}
      />
      {enhanced ? null : (
        <Button classModifiers="secondary" name="intent" value="show-sources">
          Show sources
        </Button>
      )}
      <div hidden={provider === undefined}>
        <Select
          {...(fieldErrors.sourceId === undefined ? {} : { error: fieldErrors.sourceId })}
          defaultValue={providerId === values.providerId ? values.sourceId : ''}
          // Remounted for each provider, so the choice starts again with its sources.
          key={providerId}
          label={
            provider === undefined
              ? 'Add the specific source'
              : `Add the specific source from ${provider.name}`
          }
          name="sourceId"
          options={[
            { label: 'Select a source', value: '' },
            { label: 'No specific source', value: NO_SPECIFIC_SOURCE },
            ...(provider?.sources ?? []).map(({ id, name }) => ({ label: name, value: id })),
          ]}
        />
        <Button classModifiers="secondary" name="intent" value="add">
          Add source
        </Button>
      </div>
      <Textarea
        defaultValue={values.definition}
        error={fieldErrors.definition}
        label={`Enter the definition of the ${part}`}
        name="definition"
        rows={5}
      />
    </IndicatorSectionForm>
  );
}
