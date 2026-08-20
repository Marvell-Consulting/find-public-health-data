import { OptionsAccordion, Select } from '@fphd/ui';
import { useId } from 'react';

import { type ConfidenceLevel, type PeriodType, periodTypeLabel } from './indicator-data';

/** The confidence-interval choices, narrowed to what the indicator publishes. */
export function confidenceOptions(levels: string[]) {
  return [
    { label: 'None', value: 'none' },
    ...(levels.includes('95') ? [{ label: '95%', value: '95' }] : []),
    ...(levels.includes('99.8') ? [{ label: '99.8%', value: '99.8' }] : []),
  ];
}

export interface PanelOptions {
  confidence: ConfidenceLevel;
  periodType: PeriodType;
  sex: string;
}

/**
 * The prototype's "Chart options" / "Table options" disclosure. Every panel offers the
 * confidence-interval choice; the sex and period controls appear only where the
 * indicator reports those segments.
 */
export function PanelOptionsPanel({
  confidenceLevels,
  label,
  onChange,
  options,
  periodTypes,
  sexes,
  showConfidence,
}: {
  confidenceLevels: string[];
  label: string;
  onChange: (options: PanelOptions) => void;
  options: PanelOptions;
  periodTypes: PeriodType[];
  sexes: string[];
  showConfidence: boolean;
}) {
  const ids = {
    confidence: useId(),
    period: useId(),
    sex: useId(),
  };

  return (
    <OptionsAccordion label={label}>
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

        {periodTypes.length > 1 ? (
          <Select
            id={ids.period}
            label="Select time period type"
            name="periodType"
            onChange={(event) =>
              onChange({ ...options, periodType: event.currentTarget.value as PeriodType })
            }
            options={['all' as const, ...periodTypes].map((value) => ({
              label: periodTypeLabel(value),
              value,
            }))}
            value={options.periodType}
          />
        ) : null}

        {showConfidence && confidenceLevels.length > 0 ? (
          <Select
            id={ids.confidence}
            label="Select confidence intervals"
            name="confidence"
            onChange={(event) =>
              onChange({ ...options, confidence: event.currentTarget.value as ConfidenceLevel })
            }
            options={confidenceOptions(confidenceLevels)}
            value={options.confidence}
          />
        ) : null}
      </div>
    </OptionsAccordion>
  );
}

/** The prototype's Inequalities "Options" disclosure: category, period and intervals. */
export function InequalityOptions({
  categories,
  category,
  confidence,
  confidenceLevels,
  onCategoryChange,
  onConfidenceChange,
  onPeriodChange,
  period,
  periods,
}: {
  categories: string[];
  category: string;
  confidence: ConfidenceLevel;
  confidenceLevels: string[];
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
    <OptionsAccordion label="Options">
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
        {confidenceLevels.length > 0 ? (
          <Select
            id={confidenceId}
            label="Select confidence intervals"
            name="inequalityConfidence"
            onChange={(event) => onConfidenceChange(event.currentTarget.value as ConfidenceLevel)}
            options={confidenceOptions(confidenceLevels)}
            value={confidence}
          />
        ) : null}
      </div>
    </OptionsAccordion>
  );
}
