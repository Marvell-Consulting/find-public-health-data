import { Button, CollapsibleFilterCard, Select, TextInput } from '@fphd/ui';
import { Form } from 'react-router';
import { HiddenFilters } from './filter-fields.tsx';
import { type SearchState, searchUrl } from './url.ts';

export function SearchPeriodFilter({
  state,
  action,
  extraParams,
}: {
  state: SearchState;
  action: string;
  extraParams: Record<string, string>;
}) {
  return (
    <CollapsibleFilterCard
      active={Boolean(state.fromYear || state.toYear || state.updatedWithin)}
      title="Data period"
      onClear={searchUrl(
        { ...state, fromYear: '', toYear: '', updatedWithin: '' },
        action,
        extraParams,
      )}
    >
      <Form action={action} method="get" preventScrollReset>
        <HiddenFilters state={state} extraParams={extraParams} includePeriod={false} />
        <Select
          id="topic-updated-within"
          name="updatedWithin"
          label="Last updated"
          hint="Show indicators whose figures were refreshed recently, regardless of the year the data covers."
          defaultValue={state.updatedWithin ?? ''}
          options={[
            { value: '', label: 'Any time' },
            { value: '3', label: 'In the last 3 months' },
            { value: '6', label: 'In the last 6 months' },
            { value: '12', label: 'In the last 12 months' },
          ]}
        />
        <TextInput
          id="topic-from-year"
          name="fromYear"
          label="Data from year"
          hint="Show indicators with data as far back as this year, for example 2010."
          inputMode="numeric"
          pattern="[12][0-9]{3}"
          maxLength={4}
          defaultValue={state.fromYear ?? ''}
        />
        <TextInput
          id="topic-to-year"
          name="toYear"
          label="Data up until year"
          hint="Show indicators with data as recent as this year, for example 2023."
          inputMode="numeric"
          pattern="[12][0-9]{3}"
          maxLength={4}
          defaultValue={state.toYear ?? ''}
        />
        <Button type="submit" className="govuk-button--secondary govuk-!-margin-bottom-0">
          Apply data period
        </Button>
      </Form>
    </CollapsibleFilterCard>
  );
}
