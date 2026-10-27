import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { indicatorOverviewPath } from '../indicator-overview/paths.ts';
import { useSectionForm } from '../indicator-section-route.ts';
import type { ReviewerAssignmentField, ReviewerAssignmentValues } from './form.ts';
import { assignReviewers, loadReviewerAssignment } from './loader.ts';
import { ReviewerAssignmentPage } from './page.tsx';

export const loader = loadReviewerAssignment;

export const action = assignReviewers;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(
  ({ id }) => indicatorOverviewPath(id),
  'Back to indicator overview',
);

// After an Add or a Remove, the action's answer is the page with its list changed.
export function ReviewerAssignmentRoute() {
  const { currentReviewers, options } = useLoaderData<typeof loader>();
  const form = useSectionForm<ReviewerAssignmentField, ReviewerAssignmentValues>();

  return <ReviewerAssignmentPage {...form} currentReviewers={currentReviewers} options={options} />;
}

export default ReviewerAssignmentRoute;
