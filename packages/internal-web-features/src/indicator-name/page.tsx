import { ErrorMessage, fieldInputId, Hint, Input, Label } from '@fphd/ui';

import { IndicatorSectionForm } from '../indicator-section-form.tsx';
import type { IndicatorNameFailure } from './loader.ts';

const NAME_FIELD = 'name';
const HINT_ID = `${NAME_FIELD}-hint`;
const ERROR_ID = `${NAME_FIELD}-error`;

const INDICATOR_NAME_HEADING = 'What is the name of the indicator?';

interface IndicatorNamePageProps {
  fieldErrors?: IndicatorNameFailure['fieldErrors'] | undefined;
  name?: string | undefined;
}

// The heading is the field's label, as GOV.UK asks of a page with a single question, so the
// form group is assembled here rather than taken whole from TextInput.
export function IndicatorNamePage({ fieldErrors = {}, name = '' }: IndicatorNamePageProps) {
  const error = fieldErrors[NAME_FIELD];
  const inputId = fieldInputId(NAME_FIELD);

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fields={[NAME_FIELD]}
      questionIsHeading
      title={INDICATOR_NAME_HEADING}
    >
      <div className={`govuk-form-group${error === undefined ? '' : ' govuk-form-group--error'}`}>
        <h1 className="govuk-label-wrapper">
          <Label classModifiers="xl" htmlFor={inputId}>
            {INDICATOR_NAME_HEADING}
          </Label>
        </h1>
        <Hint id={HINT_ID}>
          The name should be unique, descriptive and written in plain English.
        </Hint>
        {error === undefined ? null : <ErrorMessage id={ERROR_ID}>{error}</ErrorMessage>}
        <Input
          aria-describedby={error === undefined ? HINT_ID : `${HINT_ID} ${ERROR_ID}`}
          classModifiers={error === undefined ? [] : 'error'}
          defaultValue={name}
          id={inputId}
          name={NAME_FIELD}
        />
      </div>
    </IndicatorSectionForm>
  );
}
