import type {
  DraftStatus,
  IndicatorStatus,
  IndicatorTaskStatus,
} from '@fphd/internal-api-features/contract';
import { Tag } from '@fphd/ui';

type Colour = 'blue' | 'green' | 'teal';

interface TagFace {
  label: string;
  /** The wording where no column header names the status, as under an indicator's heading. */
  standaloneLabel?: string;
  colour: Colour;
}

const INDICATOR_STATUS: Record<IndicatorStatus, TagFace> = {
  new: { label: 'New', standaloneLabel: 'New indicator', colour: 'blue' },
  live: { label: 'Live', standaloneLabel: 'Live indicator', colour: 'teal' },
};

const DRAFT_STATUS: Record<DraftStatus, TagFace> = {
  draft: { label: 'Incomplete', colour: 'blue' },
};

const PUBLISHED: TagFace = { label: 'Published', colour: 'green' };

// The prototype tags a completed task green, where GOV.UK's pattern leaves it as plain text.
const TASK_STATUS: Record<IndicatorTaskStatus, TagFace> = {
  not_started: { label: 'Not started', colour: 'blue' },
  completed: { label: 'Completed', colour: 'green' },
};

/**
 * What is in flight. A draft of a live indicator is an update, so its label says so; a live
 * indicator with no draft is published as it stands. A new indicator with no draft cannot be
 * made, so it has no label.
 */
function publishingStatus(
  indicatorStatus: IndicatorStatus,
  draftStatus: DraftStatus | null,
): TagFace | undefined {
  if (draftStatus === null) return indicatorStatus === 'live' ? PUBLISHED : undefined;

  const { colour, label } = DRAFT_STATUS[draftStatus];

  return indicatorStatus === 'live'
    ? { colour, label: `Update ${label.toLowerCase()}` }
    : { colour, label };
}

export type StatusTagProps = (
  | { type: 'indicator'; status: IndicatorStatus }
  | { type: 'publishing'; indicatorStatus: IndicatorStatus; draftStatus: DraftStatus | null }
  | { type: 'task'; status: IndicatorTaskStatus }
) & {
  /**
   * Set false where something else, such as a column header, already names the status: the
   * tag then drops its hidden prefix and uses its short wording.
   */
  labelled?: boolean;
};

// A task's status is already read out with its link, so only the indicator's two are prefixed.
const PREFIX: Partial<Record<StatusTagProps['type'], string>> = {
  indicator: 'Indicator status: ',
  publishing: 'Publishing status: ',
};

function faceOf(props: StatusTagProps): TagFace | undefined {
  switch (props.type) {
    case 'indicator':
      return INDICATOR_STATUS[props.status];
    case 'publishing':
      return publishingStatus(props.indicatorStatus, props.draftStatus);
    case 'task':
      return TASK_STATUS[props.status];
  }
}

/** A status as the publisher reads it: the tag's colour and wording are decided here alone. */
export function StatusTag(props: StatusTagProps) {
  const face = faceOf(props);

  if (face === undefined) return null;

  const labelled = props.labelled !== false;
  const prefix = labelled ? PREFIX[props.type] : undefined;
  const label = labelled ? (face.standaloneLabel ?? face.label) : face.label;

  return (
    <Tag className="fphd-status-tag" classModifiers={face.colour}>
      {prefix === undefined ? null : <span className="govuk-visually-hidden">{prefix}</span>}
      {label}
    </Tag>
  );
}
