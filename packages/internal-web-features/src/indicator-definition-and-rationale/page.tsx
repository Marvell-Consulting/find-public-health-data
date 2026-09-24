import {
  type DefinitionAndRationaleField,
  definitionAndRationaleSection,
} from '@fphd/internal-api-features/contract';
import { Textarea } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

export function DefinitionAndRationalePage({
  fieldErrors = {},
  values,
}: SectionPageProps<DefinitionAndRationaleField>) {
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
