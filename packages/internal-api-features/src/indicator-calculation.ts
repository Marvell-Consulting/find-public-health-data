import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Router } from 'express';

import { calculationSection } from './indicator-calculation-contract.ts';
import { indicatorSectionRouter } from './indicator-section.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

export function indicatorCalculationRouter(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
): Router {
  return indicatorSectionRouter(indicators, session, calculationSection, {
    fromDraft: ({ methodology, calculatedBy, calculatedByOther }) => ({
      methodology,
      calculatedBy,
      calculatedByOther,
    }),
    // Details typed under "Other" are dropped once another organisation is chosen.
    toAttributes: ({ methodology, calculatedBy, calculatedByOther }) => ({
      methodology,
      calculatedBy,
      calculatedByOther: calculatedBy === 'other' ? calculatedByOther : null,
    }),
  });
}
