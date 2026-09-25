import {
  type PublishingDateField,
  publishingDateSection,
} from '@fphd/internal-api-features/contract';
import { DateInput, datePartId, datePartName, TimeInput } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const DATE = 'publishingDate';
const TIME = 'publishingTime';

/** Each field's group on the page and its part within it. */
const PARTS = {
  publishingDateDay: [DATE, 'day'],
  publishingDateMonth: [DATE, 'month'],
  publishingDateYear: [DATE, 'year'],
  publishingTimeHour: [TIME, 'hour'],
  publishingTimeMinute: [TIME, 'minute'],
} as const satisfies Record<PublishingDateField, readonly [string, string]>;

function eachPart(control: (group: string, part: string) => string) {
  return Object.fromEntries(
    Object.entries(PARTS).map(([field, [group, part]]) => [field, control(group, part)]),
  ) as Record<PublishingDateField, string>;
}

/** The name each field is posted under. */
export const publishingDateControlNames = eachPart(datePartName);

/** The messages on one group's parts, by part; none when no part has one. */
function groupError(
  fieldErrors: Partial<Record<PublishingDateField, string>>,
  group: string,
): Record<string, string> | undefined {
  const errors = Object.entries(PARTS).flatMap(([field, [inGroup, part]]) => {
    const message = fieldErrors[field as PublishingDateField];
    return inGroup === group && message !== undefined ? [[part, message]] : [];
  });

  return errors.length === 0 ? undefined : Object.fromEntries(errors);
}

// Each group shows its first message and marks only the parts given one.
export function PublishingDatePage({
  fieldErrors = {},
  values,
}: SectionPageProps<PublishingDateField>) {
  const dateError = groupError(fieldErrors, DATE);

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fieldIds={eachPart(datePartId)}
      fields={publishingDateSection.fields.options}
      title="When should this indicator be published?"
    >
      <DateInput
        defaultValue={{
          day: values.publishingDateDay,
          month: values.publishingDateMonth,
          year: values.publishingDateYear,
        }}
        {...(dateError === undefined ? {} : { error: dateError })}
        hint="For example, 14 9 2026"
        // NotGovUK sizes a legend by the heading passed as its label.
        label={<h2 className="govuk-heading-m">Date</h2>}
        name={DATE}
      />
      <TimeInput
        defaultValue={{ hour: values.publishingTimeHour, minute: values.publishingTimeMinute }}
        error={groupError(fieldErrors, TIME)}
        hint="This will be 09:30 local UK time by default. Only change this if a different publication time is needed. Use 24 hour clock format, for example 15:00."
        label={<h2 className="govuk-heading-m">Time</h2>}
        name={TIME}
      />
    </IndicatorSectionForm>
  );
}
