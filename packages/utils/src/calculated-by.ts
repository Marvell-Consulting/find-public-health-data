/** Who calculated an indicator: OHID, DHSC, or organisations named in `calculated_by_detail`. */
export const INDICATOR_CALCULATED_BY = ['ohid', 'dhsc', 'other'] as const;

export type IndicatorCalculatedBy = (typeof INDICATOR_CALCULATED_BY)[number];

export const INDICATOR_CALCULATED_BY_LABELS: Readonly<Record<IndicatorCalculatedBy, string>> = {
  ohid: 'Office for Health Improvement and Disparities',
  dhsc: 'Department of Health and Social Care',
  other: 'Other organisation or organisations',
};
