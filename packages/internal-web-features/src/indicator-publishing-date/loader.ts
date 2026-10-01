// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import {
  DEFAULT_PUBLISHING_TIME,
  publishingDateExample,
  publishingDateSection,
} from '@fphd/internal-api-features/contract';
import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection } from '../indicator-section.ts';

/**
 * The draft's answers, offering the default time until a date and time are saved, and an
 * example date from today's.
 */
export async function loadPublishingDate(args: LoaderFunctionArgs) {
  const { id, values } = await loadIndicatorSection(args, publishingDateSection);
  const unanswered = values.publishingTimeHour === '' && values.publishingTimeMinute === '';

  return {
    id,
    values: unanswered ? { ...values, ...DEFAULT_PUBLISHING_TIME } : values,
    dateExample: publishingDateExample(new Date()),
  };
}
