import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Router } from 'express';

import { definitionAndRationaleSection } from './indicator-definition-and-rationale-contract.ts';
import { indicatorSectionRouter } from './indicator-section.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

export function indicatorDefinitionAndRationaleRouter(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
): Router {
  return indicatorSectionRouter(indicators, session, definitionAndRationaleSection, {
    fromDraft: ({ definition, rationale }) => ({ definition, rationale }),
    toAttributes: ({ definition, rationale }) => ({ definition, rationale }),
  });
}
