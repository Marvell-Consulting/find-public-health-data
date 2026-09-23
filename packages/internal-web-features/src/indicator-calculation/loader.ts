// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import { calculationSection } from '@fphd/internal-api-features/contract';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';

export type { CalculationField } from '@fphd/internal-api-features/contract';

export function loadCalculation(args: LoaderFunctionArgs) {
  return loadIndicatorSection(args, calculationSection);
}

export function saveCalculation(args: ActionFunctionArgs) {
  return saveIndicatorSection(args, calculationSection);
}
