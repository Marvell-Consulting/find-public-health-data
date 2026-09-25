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

interface PartsInputProps<Part extends string> {
  defaultValue: Record<Part, string>;
  /** A message on each part to correct; the first is shown, and each part given one is marked. */
  error?: Partial<Record<Part, string>> | undefined;
  hint?: ReactNode;
  label: ReactNode;
  name: string;
}

/** Two-digit number boxes under one legend, built as NotGovUK's DateInput builds its parts. */
function PartsInput<Part extends string>({
  defaultValue,
  error = {},
  hint,
  label,
  name,
  parts,
}: PartsInputProps<Part> & { parts: readonly (readonly [Part, string])[] }) {
  const message = parts.map(([part]) => error[part]).find((text) => text !== undefined);

  return (
    <FormGroup error={message} hint={hint} id={name} label={label}>
      <div className="govuk-date-input">
        {parts.map(([part, text]) => (
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

export interface TimeInputValue {
  hour: string;
  minute: string;
}

const TIME_PARTS = [
  ['hour', 'Hour'],
  ['minute', 'Minute'],
] as const;

/** Hour and minute: GOV.UK has no time input. */
export function TimeInput(props: PartsInputProps<keyof TimeInputValue>) {
  return <PartsInput parts={TIME_PARTS} {...props} />;
}

export interface DayMonthInputValue {
  day: string;
  month: string;
}

const DAY_MONTH_PARTS = [
  ['day', 'Day'],
  ['month', 'Month'],
] as const;

/** A day and month with no year, as GOV.UK's date input allows by leaving the year out. */
export function DayMonthInput(props: PartsInputProps<keyof DayMonthInputValue>) {
  return <PartsInput parts={DAY_MONTH_PARTS} {...props} />;
}
