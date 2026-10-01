import {
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import { type ActionFunctionArgs, useLoaderData } from 'react-router';

import { saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { loadValueTypeAndUnits } from './loader.ts';
import { ValueTypeAndUnitsPage } from './page.tsx';

export const loader = loadValueTypeAndUnits;

// The form checks that a value type and unit are chosen; the API checks that it offers them.
export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, valueTypeAndUnitsSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function ValueTypeAndUnitsRoute() {
  const { valueTypes, units } = useLoaderData<typeof loader>();
  const form = useSectionForm<ValueTypeAndUnitsField>();

  return <ValueTypeAndUnitsPage {...form} units={units} valueTypes={valueTypes} />;
}

export default ValueTypeAndUnitsRoute;
