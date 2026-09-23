import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Router } from 'express';

import { polaritySection } from './indicator-polarity-contract.ts';
import { indicatorSectionRouter } from './indicator-section.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

export function indicatorPolarityRouter(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
): Router {
  return indicatorSectionRouter(indicators, session, polaritySection, {
    fromDraft: ({ polarity }) => ({ polarity }),
    toAttributes: ({ polarity }) => ({ polarity }),
  });
}
