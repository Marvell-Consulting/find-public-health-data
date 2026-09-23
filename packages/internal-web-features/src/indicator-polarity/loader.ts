// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import { polaritySection } from '@fphd/internal-api-features/contract';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';

export type { PolarityField } from '@fphd/internal-api-features/contract';

export function loadPolarity(args: LoaderFunctionArgs) {
  return loadIndicatorSection(args, polaritySection);
}

export function savePolarity(args: ActionFunctionArgs) {
  return saveIndicatorSection(args, polaritySection);
}
