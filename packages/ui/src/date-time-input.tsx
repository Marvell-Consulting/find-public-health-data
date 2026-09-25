import FormGroup from '@not-govuk/form-group';
import Input from '@not-govuk/input';
import Label from '@not-govuk/label';
import type { ReactNode } from 'react';

// NotGovUK's DateInput names each part `name[part]` and gives it the id `name-part`.
export function datePartName(name: string, part: string): string {
  return `${name}[${part}]`;
}

export function datePartId(name: string, part: string): string {
  return `${name}-${part}`;
}

export interface TimeInputValue {
  hour: string;
  minute: string;
}

interface TimeInputProps {
  defaultValue: TimeInputValue;
  /** A message on each part to correct; the first is shown, and each part given one is marked. */
  error?: Partial<TimeInputValue> | undefined;
  hint?: ReactNode;
  label: ReactNode;
  name: string;
}

const TIME_PARTS = [
  ['hour', 'Hour'],
  ['minute', 'Minute'],
] as const;

/** Hour and minute, built as NotGovUK's DateInput builds its parts: GOV.UK has no time input. */
export function TimeInput({ defaultValue, error = {}, hint, label, name }: TimeInputProps) {
  return (
    <FormGroup error={error.hour ?? error.minute} hint={hint} id={name} label={label}>
      <div className="govuk-date-input">
        {TIME_PARTS.map(([part, text]) => (
          <div className="govuk-date-input__item" key={part}>
            <Label htmlFor={datePartId(name, part)}>{text}</Label>
            <Input
              className="govuk-date-input__input"
              classModifiers={error[part] === undefined ? ['width-2'] : ['width-2', 'error']}
              defaultValue={defaultValue[part]}
              id={datePartId(name, part)}
              inputMode="numeric"
              name={datePartName(name, part)}
            />
          </div>
        ))}
      </div>
    </FormGroup>
  );
}
