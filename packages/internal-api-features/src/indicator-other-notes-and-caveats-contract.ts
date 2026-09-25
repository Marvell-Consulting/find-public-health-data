import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

const fields = z.enum([
  'disclosureControl',
  'disclosureControlDetail',
  'roundingApplied',
  'roundingDetail',
  'caveatsNeeded',
  'caveatsDetail',
  'otherNotesNeeded',
  'otherNotesDetail',
]);

const yesNo = (error: string) => z.enum(['yes', 'no'], { error });

/** Each question's detail, asked for only under a yes, and the message when it is missing. */
const DETAILS = [
  ['disclosureControl', 'disclosureControlDetail', 'Provide details of the disclosure control'],
  ['roundingApplied', 'roundingDetail', 'Provide details of the rounding'],
  ['caveatsNeeded', 'caveatsDetail', 'Provide details of the caveats'],
  ['otherNotesNeeded', 'otherNotesDetail', 'Provide details of the other notes'],
] as const;

const schema = z
  .object({
    disclosureControl: z.enum(['yes', 'no', 'not-applicable'], {
      error: 'Select whether disclosure control has been applied',
    }),
    disclosureControlDetail: z.string().trim(),
    roundingApplied: yesNo('Select whether rounding has been applied'),
    roundingDetail: z.string().trim(),
    caveatsNeeded: yesNo('Select whether there are any caveats needed'),
    caveatsDetail: z.string().trim(),
    otherNotesNeeded: yesNo('Select whether there are any other notes needed'),
    otherNotesDetail: z.string().trim(),
  })
  .superRefine(
    (answers, ctx) => {
      for (const [answer, detail, message] of DETAILS) {
        if (answers[answer] === 'yes' && answers[detail] === '') {
          ctx.addIssue({ code: 'custom', path: [detail], message });
        }
      }
    },
    // Also beside an unanswered question, so every refusal shows at once.
    { when: ({ value }) => typeof value === 'object' && value !== null },
  );

export type OtherNotesAndCaveatsField = z.infer<typeof fields>;
export type OtherNotesAndCaveats = z.infer<typeof schema>;

export const otherNotesAndCaveatsSection: IndicatorSection<
  OtherNotesAndCaveatsField,
  OtherNotesAndCaveats
> = { key: 'other-notes-and-caveats', fields, schema };
