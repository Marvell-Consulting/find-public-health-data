/** Whether disclosure control was applied, described in `disclosure_control_detail` when it was. */
export const INDICATOR_DISCLOSURE_CONTROL = ['yes', 'no', 'not-applicable'] as const;

export type IndicatorDisclosureControl = (typeof INDICATOR_DISCLOSURE_CONTROL)[number];

export const INDICATOR_DISCLOSURE_CONTROL_LABELS: Readonly<
  Record<IndicatorDisclosureControl, string>
> = {
  yes: 'Yes',
  no: 'No',
  'not-applicable': 'Not applicable',
};
