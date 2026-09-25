import {
  type PublishingDateField,
  publishingDateSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs } from 'react-router';

import { saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { loadPublishingDate } from './loader.ts';
import { PublishingDatePage, publishingDateControlNames } from './page.tsx';

export const loader = loadPublishingDate;

// The form checks the date and time are real; the API checks the date is at least 28 days from
// today and the time exists in UK time on it.
export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, publishingDateSection, publishingDateControlNames);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function PublishingDateRoute() {
  return <PublishingDatePage {...useSectionForm<PublishingDateField>()} />;
}

export default PublishingDateRoute;
