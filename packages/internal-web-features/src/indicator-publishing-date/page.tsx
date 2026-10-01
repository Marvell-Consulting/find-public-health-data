import {
  type PublishingDateField,
  publishingDateSection,
} from '@fphd/internal-api-features/contract';
import { DateInput, datePartId, datePartName, QuestionLegend, TimeInput } from '@fphd/ui';

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

interface PublishingDatePageProps extends SectionPageProps<PublishingDateField> {
  /** A date the form would accept, as day, month and year numbers separated by spaces. */
  dateExample: string;
}

// Each group shows its first message and marks only the parts given one.
export function PublishingDatePage({ dateExample, ...form }: PublishingDatePageProps) {
  const { fieldErrors, values } = form;

  return (
    <IndicatorSectionForm
      fieldIds={eachPart(datePartId)}
      form={form}
      section={publishingDateSection}
      title="When should this indicator be published?"
    >
      <DateInput
        defaultValue={{
          day: values.publishingDateDay,
          month: values.publishingDateMonth,
          year: values.publishingDateYear,
        }}
        error={groupError(fieldErrors, DATE)}
        hint={`For example, ${dateExample}`}
        label={<QuestionLegend>Date</QuestionLegend>}
        name={DATE}
      />
      <TimeInput
        defaultValue={{ hour: values.publishingTimeHour, minute: values.publishingTimeMinute }}
        error={groupError(fieldErrors, TIME)}
        hint="This will be 09:30 local UK time by default. Only change this if a different publication time is needed. Use 24 hour clock format, for example 15:00."
        label={<QuestionLegend>Time</QuestionLegend>}
        name={TIME}
      />
    </IndicatorSectionForm>
  );
}
