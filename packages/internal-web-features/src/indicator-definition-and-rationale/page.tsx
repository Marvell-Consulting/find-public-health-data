import { definitionAndRationaleSection } from '@fphd/internal-api-features/contract';
import { Textarea } from '@fphd/ui';

import type { FormFailure, FormValues } from '../indicator-section.ts';
import { IndicatorSectionForm } from '../indicator-section-form.tsx';
import type { DefinitionAndRationaleField } from './loader.ts';

interface DefinitionAndRationalePageProps {
  fieldErrors?: FormFailure<DefinitionAndRationaleField>['fieldErrors'] | undefined;
  values: FormValues<DefinitionAndRationaleField>;
}

export function DefinitionAndRationalePage({
  fieldErrors = {},
  values,
}: DefinitionAndRationalePageProps) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fields={definitionAndRationaleSection.fields.options}
      title="Definition and rationale"
    >
      <Textarea
        defaultValue={values.definition}
        error={fieldErrors.definition}
        label="What is the definition of this indicator?"
        name="definition"
        rows={8}
      />
      <Textarea
        defaultValue={values.rationale}
        error={fieldErrors.rationale}
        label="What is the rationale for this indicator?"
        name="rationale"
        rows={15}
      />
    </IndicatorSectionForm>
  );
}
