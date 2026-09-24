import {
  type CiMethod,
  type ConfidenceIntervalsField,
  confidenceIntervalsSection,
} from '@fphd/internal-api-features/contract';
import { fieldInputId, firstRadioId, Radios, Select, Textarea } from '@fphd/ui';
import { useEffect, useState } from 'react';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

interface ConfidenceIntervalsPageProps extends SectionPageProps<ConfidenceIntervalsField> {
  methods: readonly CiMethod[];
}

const listWithOr = new Intl.ListFormat('en-GB', { type: 'disjunction' });

/**
 * A select cannot reveal anything without JavaScript, so until the page is hydrated every
 * follow-up shows, hinted with the methods it is for; after, only the chosen method's show.
 */
export function ConfidenceIntervalsPage({
  fieldErrors = {},
  methods,
  values,
}: ConfidenceIntervalsPageProps) {
  const [methodId, setMethodId] = useState(values.ciMethodId);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    // A method chosen before hydration is in the select but not yet in state.
    const select = document.getElementById(fieldInputId('ciMethodId'));
    if (select instanceof HTMLSelectElement) setMethodId(select.value);
    setEnhanced(true);
  }, []);

  const method = methods.find(({ id }) => id === methodId);
  const namesOf = (test: (method: CiMethod) => boolean) =>
    listWithOr.format(methods.filter(test).map(({ name }) => name));
  const hint = (text: string) => (enhanced ? {} : { hint: text });
  const showsFor = (kind: CiMethod['kind']) => !enhanced || method?.kind === kind;
  // Select and Radios take no undefined error.
  const errorOf = (field: ConfidenceIntervalsField) => {
    const error = fieldErrors[field];
    return error === undefined ? {} : { error };
  };

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fieldIds={{ ciMethodModified: firstRadioId('ciMethodModified') }}
      fields={confidenceIntervalsSection.fields.options}
      title="Confidence intervals"
    >
      <Select
        {...errorOf('ciMethodId')}
        defaultValue={values.ciMethodId}
        label="Select the confidence interval method used"
        name="ciMethodId"
        onChange={(event) => setMethodId(event.target.value)}
        options={[
          { label: 'Select', value: '' },
          ...methods.map(({ id, name }) => ({ label: name, value: id })),
        ]}
      />
      <div hidden={!showsFor('standard')}>
        {method?.kind === 'standard' && method.description !== null ? (
          <>
            <h2 className="govuk-heading-s">Standard description</h2>
            <p className="govuk-body fphd-metadata-text">{method.description}</p>
          </>
        ) : null}
        <Radios
          {...hint(`Not needed for ${namesOf(({ kind }) => kind !== 'standard')}`)}
          {...errorOf('ciMethodModified')}
          defaultValue={values.ciMethodModified}
          label={
            // NotGovUK sizes a legend by the heading passed as its label.
            <h2 className="govuk-heading-m">
              Were any modifications to the described method used for this indicator?
            </h2>
          }
          name="ciMethodModified"
          options={[
            {
              label: 'Yes',
              value: 'yes',
              conditional: (
                <Textarea
                  defaultValue={values.ciMethodModifications}
                  error={fieldErrors.ciMethodModifications}
                  label="Enter description of the modifications used"
                  name="ciMethodModifications"
                />
              ),
            },
            { label: 'No', value: 'no' },
          ]}
        />
      </div>
      <div hidden={!showsFor('other')}>
        <Textarea
          {...hint(`Only needed for ${namesOf(({ kind }) => kind === 'other')}`)}
          defaultValue={values.ciMethodOtherDetail}
          error={fieldErrors.ciMethodOtherDetail}
          label="Provide detail of the other confidence interval method used"
          name="ciMethodOtherDetail"
        />
      </div>
    </IndicatorSectionForm>
  );
}
