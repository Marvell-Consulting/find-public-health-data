/**
 * What choosing a confidence interval method asks of a publisher next: a standard method's
 * modifications, an other method's detail, or nothing for a method that has none to describe.
 */
export const CI_METHOD_KINDS = ['standard', 'other', 'none'] as const;

export type CiMethodKind = (typeof CI_METHOD_KINDS)[number];
