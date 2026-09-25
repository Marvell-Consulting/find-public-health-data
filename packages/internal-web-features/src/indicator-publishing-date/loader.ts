// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import {
  DEFAULT_PUBLISHING_TIME,
  publishingDateSection,
} from '@fphd/internal-api-features/contract';
import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection } from '../indicator-section.ts';

/** The draft's answers, offering the default time until a date and time are saved. */
export async function loadPublishingDate(args: LoaderFunctionArgs) {
  const section = await loadIndicatorSection(args, publishingDateSection);
  const { publishingTimeHour, publishingTimeMinute } = section.values;

  return publishingTimeHour === '' && publishingTimeMinute === ''
    ? { ...section, values: { ...section.values, ...DEFAULT_PUBLISHING_TIME } }
    : section;
}
