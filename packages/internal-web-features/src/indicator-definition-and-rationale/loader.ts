// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import { definitionAndRationaleSection } from '@fphd/internal-api-features/contract';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';

export type { DefinitionAndRationaleField } from '@fphd/internal-api-features/contract';

export function loadDefinitionAndRationale(args: LoaderFunctionArgs) {
  return loadIndicatorSection(args, definitionAndRationaleSection);
}

export function saveDefinitionAndRationale(args: ActionFunctionArgs) {
  return saveIndicatorSection(args, definitionAndRationaleSection);
}
