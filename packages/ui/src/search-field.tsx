import { SubmitButton } from '@not-govuk/button';
import Input from '@not-govuk/input';
import Label from '@not-govuk/label';
import type { ReactNode } from 'react';

// The search-box component hides its label; this keeps the same input and button styling
// under a visible one, with an optional action on the label's line.
export function SearchField({
  action,
  defaultValue,
  id,
  label,
  labelSize = 'm',
  name,
}: {
  action?: ReactNode;
  defaultValue?: string;
  id: string;
  label: string;
  labelSize?: 's' | 'm' | 'l';
  name: string;
}) {
  const inputId = `${id}-input`;
  return (
    <div className="govuk-form-group">
      <div className="fphd-search-bar__label-row">
        <Label className="govuk-!-margin-bottom-0" classModifiers={labelSize} htmlFor={inputId}>
          {label}
        </Label>
        {action}
      </div>
      <div className="not-govuk-standalone-input not-govuk-search-box fphd-search-bar">
        <Input
          autoComplete="off"
          className="not-govuk-standalone-input__input"
          defaultValue={defaultValue}
          id={inputId}
          name={name}
          type="search"
        />
        <SubmitButton className="not-govuk-standalone-input__button">
          Search
          <svg
            aria-hidden="true"
            className="not-govuk-search-box__icon"
            fill="none"
            focusable="false"
            height="27"
            viewBox="0 0 27 27"
            width="27"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12.0161" cy="11.0161" r="8.51613" stroke="currentColor" strokeWidth="3" />
            <line
              stroke="currentColor"
              strokeWidth="3"
              x1="17.8668"
              x2="26.4475"
              y1="17.3587"
              y2="25.9393"
            />
          </svg>
        </SubmitButton>
      </div>
    </div>
  );
}
