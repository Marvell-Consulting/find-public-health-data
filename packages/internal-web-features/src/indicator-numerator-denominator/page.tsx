import {
  type DataProvider,
  type IndicatorSourcePart,
  NO_SPECIFIC_SOURCE,
  type ProviderSource,
  providerSourceLabel,
} from '@fphd/internal-api-features/contract';
import { Button, errorProp, fieldInputId, Select, Textarea } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { ADD_INTENT, removeIntent } from '../list-form.ts';
import { useSelectedValue } from '../selected-value.ts';
import {
  type NumeratorDenominatorPageField,
  type NumeratorDenominatorPageValues,
  SHOW_SOURCES_INTENT,
  sourceFieldName,
} from './form.ts';

// The order the error summary lists them in, which is the order the page asks.
const FIELDS: readonly NumeratorDenominatorPageField[] = [
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
              value={removeIntent(index)}
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

interface NumeratorDenominatorPageProps
  extends SectionPageProps<NumeratorDenominatorPageField, NumeratorDenominatorPageValues> {
  part: IndicatorSourcePart;
  providers: readonly DataProvider[];
}

/**
 * The numerator's or denominator's sources and definition. A provider's sources are offered
 * once it is chosen: in the browser as soon as it is, and without JavaScript by Show sources,
 * which sends the form back with the provider chosen.
 */
export function NumeratorDenominatorPage({
  part,
  providers,
  ...form
}: NumeratorDenominatorPageProps) {
  const { fieldErrors, values } = form;
  const selected = useSelectedValue<NumeratorDenominatorPageField>('providerId', values.providerId);
  const provider = providers.find(({ id }) => id === selected.value);
  // Nothing added yet is asked of the provider select, where the first source is chosen.
  const providerError = fieldErrors.providerId ?? fieldErrors.sources;

  return (
    <IndicatorSectionForm
      continueOnEnter
      fieldIds={{ sources: fieldInputId('providerId') }}
      fields={FIELDS}
      form={form}
      title={`What are the details of the ${part}?`}
    >
      <AddedSources providers={providers} sources={values.sources} />
      <Select
        {...errorProp(providerError)}
        defaultValue={values.providerId}
        label={`Add a data provider for the ${part}`}
        name="providerId"
        onChange={selected.onChange}
        options={[
          { label: 'Select a data provider', value: '' },
          ...providers.map(({ id, name }) => ({ label: name, value: id })),
        ]}
      />
      {selected.enhanced ? null : (
        <Button classModifiers="secondary" name="intent" value={SHOW_SOURCES_INTENT}>
          Show sources
        </Button>
      )}
      <div hidden={provider === undefined}>
        <Select
          {...errorProp(fieldErrors.sourceId)}
          defaultValue={selected.value === values.providerId ? values.sourceId : ''}
          // Remounted for each provider, so the choice starts again with its sources.
          key={selected.value}
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
        <Button classModifiers="secondary" name="intent" value={ADD_INTENT}>
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
