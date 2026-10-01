import type { SectionPageProps } from './indicator-section-form.tsx';

/** A section page's props when the last submission was not refused, for page tests. */
export const noRefusal: Omit<SectionPageProps<never, unknown>, 'values'> = {
  fieldErrors: {},
  formError: undefined,
};
