import { Details, Select } from '@fphd/ui';
import { useId } from 'react';

import { type ConfidenceLevel, type PeriodType, periodTypeLabel } from './indicator-data';

/** The confidence-interval choices every panel offers. */
export const CONFIDENCE_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: '95%', value: '95' },
  { label: '99.8%', value: '99.8' },
];

export interface PanelOptions {
  benchmark: string;
  confidence: ConfidenceLevel;
  periodType: PeriodType;
  sex: string;
}

/**
 * The prototype's "Chart options" / "Table options" disclosure. Every panel offers the
 * benchmark and confidence-interval choices; the sex and period controls appear only
 * where the indicator reports those segments.
 */
export function PanelOptionsPanel({
  benchmarks,
  label,
  onChange,
  options,
  sexes,
  showConfidence,
}: {
  benchmarks: string[];
  label: string;
  onChange: (options: PanelOptions) => void;
  options: PanelOptions;
  sexes: string[];
  showConfidence: boolean;
}) {
  const ids = {
    benchmark: useId(),
    confidence: useId(),
    period: useId(),
    sex: useId(),
  };

  return (
    <Details summary={label} open>
      <div className="fphd-segmentation-options__selects">
        {sexes.length > 0 ? (
          <Select
            id={ids.sex}
            label="Select sex"
            name="sex"
            onChange={(event) => onChange({ ...options, sex: event.currentTarget.value })}
            options={[
              { label: 'All', value: '' },
              ...sexes.map((value) => ({ label: value, value })),
            ]}
            value={options.sex}
          />
        ) : null}

        <Select
          id={ids.period}
          label="Select time period type"
          name="periodType"
          onChange={(event) =>
            onChange({ ...options, periodType: event.currentTarget.value as PeriodType })
          }
          options={(['all', '1-year', '3-year'] as const).map((value) => ({
            label: periodTypeLabel(value),
            value,
          }))}
          value={options.periodType}
        />

        {showConfidence ? (
          <Select
            id={ids.confidence}
            label="Select confidence intervals"
            name="confidence"
            onChange={(event) =>
              onChange({ ...options, confidence: event.currentTarget.value as ConfidenceLevel })
            }
            options={CONFIDENCE_OPTIONS}
            value={options.confidence}
          />
        ) : null}

        <Select
          id={ids.benchmark}
          label="Select a geography or goal to compare with"
          name="benchmark"
          onChange={(event) => onChange({ ...options, benchmark: event.currentTarget.value })}
          options={[
            { label: 'None', value: '' },
            ...benchmarks.map((value) => ({ label: value, value })),
          ]}
          value={options.benchmark}
        />
      </div>
    </Details>
  );
}

/** The prototype's Inequalities "Options" disclosure: category, period and intervals. */
export function InequalityOptions({
  categories,
  category,
  confidence,
  onCategoryChange,
  onConfidenceChange,
  onPeriodChange,
  period,
  periods,
}: {
  categories: string[];
  category: string;
  confidence: ConfidenceLevel;
  onCategoryChange: (value: string) => void;
  onConfidenceChange: (value: ConfidenceLevel) => void;
  onPeriodChange: (value: string) => void;
  period: string;
  periods: { value: string; label: string }[];
}) {
  const categoryId = useId();
  const periodId = useId();
  const confidenceId = useId();

  return (
    <Details summary="Options" open>
      <div className="fphd-segmentation-options__selects">
        <Select
          id={categoryId}
          label="Select inequality category"
          name="inequalityCategory"
          onChange={(event) => onCategoryChange(event.currentTarget.value)}
          options={categories.map((value) => ({ label: value, value }))}
          value={category}
        />
        <Select
          id={periodId}
          label="Select time period"
          name="inequalityPeriod"
          onChange={(event) => onPeriodChange(event.currentTarget.value)}
          options={periods}
          value={period}
        />
        <Select
          id={confidenceId}
          label="Select confidence intervals"
          name="inequalityConfidence"
          onChange={(event) => onConfidenceChange(event.currentTarget.value as ConfidenceLevel)}
          options={CONFIDENCE_OPTIONS}
          value={confidence}
        />
      </div>
    </Details>
  );
}
