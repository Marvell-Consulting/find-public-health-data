import {
  BackLink,
  Button,
  ErrorMessage,
  ErrorSummary,
  type FieldError,
  fieldInputId,
  GridColumn,
  GridRow,
  Hint,
  Input,
  Label,
} from '@fphd/ui';

import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import type { IndicatorFieldErrors } from './loader.ts';

const NAME_FIELD = 'name';
const HINT_ID = `${NAME_FIELD}-hint`;
const ERROR_ID = `${NAME_FIELD}-error`;

export const NEW_INDICATOR_HEADING = 'What is the name of the indicator?';

function toErrorSummary(fieldErrors: IndicatorFieldErrors): FieldError[] {
  const message = fieldErrors[NAME_FIELD];

  return message === undefined ? [] : [{ name: NAME_FIELD, message }];
}

interface NewIndicatorPageProps {
  fieldErrors?: IndicatorFieldErrors | undefined;
  name?: string | undefined;
}

// The heading is the field's label, as GOV.UK asks of a page with a single question, so the
// form group is assembled here rather than taken whole from TextInput.
export function NewIndicatorPage({ fieldErrors = {}, name = '' }: NewIndicatorPageProps) {
  const error = fieldErrors[NAME_FIELD];
  const inputId = fieldInputId(NAME_FIELD);

  return (
    <>
      <BackLink href={DASHBOARD_PATH}>Back to indicators</BackLink>
      <ErrorSummary errors={toErrorSummary(fieldErrors)} />
      <GridRow>
        <GridColumn width="two-thirds">
          {/* A plain form posting back to its own page, so it works without JavaScript. */}
          <form method="post">
            <div
              className={`govuk-form-group${error === undefined ? '' : ' govuk-form-group--error'}`}
            >
              <h1 className="govuk-label-wrapper">
                <Label classModifiers="xl" htmlFor={inputId}>
                  {NEW_INDICATOR_HEADING}
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
            <Button type="submit">Continue</Button>
          </form>
        </GridColumn>
      </GridRow>
    </>
  );
}
