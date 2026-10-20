import type { Team } from '@fphd/auth';
import { firstRadioId, Radios } from '@fphd/ui';

import { IndicatorSectionForm, QUESTION_HEADING_SIZE } from '../indicator-section-form.tsx';
import { type IndicatorTeamFailure, TEAM_FIELD } from './loader.ts';

const TEAM_QUESTION = 'Which of your teams should own this indicator?';

interface IndicatorTeamPageProps {
  fieldErrors?: IndicatorTeamFailure['fieldErrors'] | undefined;
  teams: readonly Team[];
}

// The question is the page's h1, inside the legend.
export function IndicatorTeamPage({ fieldErrors = {}, teams }: IndicatorTeamPageProps) {
  return (
    <IndicatorSectionForm
      fieldIds={{ [TEAM_FIELD]: firstRadioId(TEAM_FIELD) }}
      fields={[TEAM_FIELD]}
      form={{ fieldErrors, formError: undefined }}
      questionIsHeading
      title={TEAM_QUESTION}
    >
      <Radios
        error={fieldErrors[TEAM_FIELD]}
        label={TEAM_QUESTION}
        labelClassModifiers={QUESTION_HEADING_SIZE}
        labelHeading="h1"
        name={TEAM_FIELD}
        options={teams.map(({ id, name }) => ({ label: name, value: id }))}
      />
    </IndicatorSectionForm>
  );
}
