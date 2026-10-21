import {
  TAG_LIST_DETAILS,
  type TagList,
  type TagOption,
  type TagOptions,
} from '@fphd/internal-api-features/contract';
import { Button, fieldInputId, firstRadioId, Radios, SelectAutocomplete } from '@fphd/ui';
import type { ElementType } from 'react';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { addIntent, removeIntent } from '../list-form.ts';
import { ADD_TAG_FIELDS, type TaggingPageField, type TaggingPageValues } from './form.ts';

type FieldErrors = Partial<Record<TaggingPageField, string>>;

const LIFE_STAGE_QUESTION = 'Does this indicator need a life stage tag?';
const FRAMEWORK_QUESTION = 'Is this indicator part of a framework or programme?';

// The order the error summary lists them in, which is the order the page asks.
const FIELDS: readonly TaggingPageField[] = [
  'isAreaContext',
  'topicIds',
  'addTopic',
  'indicatorTypeIds',
  'addIndicatorType',
  'hasLifeStage',
  'lifeStageIds',
  'addLifeStage',
  'hasFramework',
  'frameworkIds',
  'addFramework',
];

/**
 * One list of tags: a select and its Add button, then the tags added so far, each carried in
 * a hidden field until Continue saves it. A tag the page no longer offers is left out.
 */
function TagPicker({
  list,
  options,
  values,
  fieldErrors,
  labelHeading,
}: {
  list: TagList;
  options: readonly TagOption[];
  values: TaggingPageValues;
  fieldErrors: FieldErrors;
  /** Set where the picker asks a question of its own, rather than answering one above it. */
  labelHeading?: ElementType | undefined;
}) {
  const { article, noun } = TAG_LIST_DETAILS[list];
  const field = ADD_TAG_FIELDS[list];
  const added = values[list].flatMap((id) => options.filter((option) => option.id === id));

  return (
    <div className="govuk-!-margin-bottom-6">
      {/* The select and its Add button side by side, as one control. */}
      <div className="fphd-field-row fphd-field-row--with-button">
        <SelectAutocomplete
          // A list refused as a whole is shown on the select that adds to it.
          defaultValue={values[field]}
          error={fieldErrors[field] ?? fieldErrors[list]}
          label={`Select ${article} ${noun}`}
          labelHeading={labelHeading}
          name={field}
          options={[
            { label: 'Select', value: '' },
            ...options.map(({ id, name }) => ({ label: name, value: id })),
          ]}
        />
        <Button classModifiers="secondary" name="intent" value={addIntent(list)}>
          Add {noun}
        </Button>
      </div>
      {added.length === 0 ? null : (
        <ul className="fphd-added-list">
          {added.map(({ id, name }, index) => (
            <li className="fphd-added-list__item" key={id}>
              <input name={list} type="hidden" value={id} />
              <span>{name}</span>
              <Button
                classModifiers="secondary"
                className="govuk-!-margin-bottom-0"
                name="intent"
                value={removeIntent(index, list)}
              >
                {'Remove '}
                <span className="govuk-visually-hidden">
                  {noun} {name}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TaggingPageProps extends SectionPageProps<TaggingPageField, TaggingPageValues> {
  options: TagOptions;
}

export function TaggingPage({ options, ...form }: TaggingPageProps) {
  const { fieldErrors, values } = form;
  const picker = (list: TagList, labelHeading?: ElementType) => (
    <TagPicker
      fieldErrors={fieldErrors}
      list={list}
      labelHeading={labelHeading}
      options={options[TAG_LIST_DETAILS[list].options]}
      values={values}
    />
  );

  return (
    <IndicatorSectionForm
      continueOnEnter
      fieldIds={{
        isAreaContext: firstRadioId('isAreaContext'),
        topicIds: fieldInputId('addTopic'),
        indicatorTypeIds: fieldInputId('addIndicatorType'),
        hasLifeStage: firstRadioId('hasLifeStage'),
        lifeStageIds: fieldInputId('addLifeStage'),
        hasFramework: firstRadioId('hasFramework'),
        frameworkIds: fieldInputId('addFramework'),
      }}
      fields={FIELDS}
      form={form}
      title="Add tags for this indicator"
    >
      <Radios
        defaultValue={values.isAreaContext === 'yes' ? 'yes' : 'no'}
        error={fieldErrors.isAreaContext}
        label="Does this indicator provide population or area context?"
        hint="Area context indicators do not have topic or tag assignments."
        labelHeading="h2"
        name="isAreaContext"
        options={[
          { label: 'Yes', value: 'yes' },
          {
            label: 'No',
            value: 'no',
            conditional: (
              <>
                {picker('topicIds', 'h2')}
                {picker('indicatorTypeIds', 'h2')}
                <Radios
                  defaultValue={values.hasLifeStage}
                  error={fieldErrors.hasLifeStage}
                  label={LIFE_STAGE_QUESTION}
                  hint="Only add a life stage tag where the age metadata does not show it."
                  labelHeading="h2"
                  name="hasLifeStage"
                  options={[
                    // Shown without JavaScript; with it, only while "Yes" is chosen.
                    { label: 'Yes', value: 'yes', conditional: picker('lifeStageIds', 'h3') },
                    { label: 'No', value: 'no' },
                  ]}
                />
                <Radios
                  defaultValue={values.hasFramework}
                  error={fieldErrors.hasFramework}
                  label={FRAMEWORK_QUESTION}
                  labelHeading="h2"
                  name="hasFramework"
                  options={[
                    { label: 'Yes', value: 'yes', conditional: picker('frameworkIds', 'h3') },
                    { label: 'No', value: 'no' },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </IndicatorSectionForm>
  );
}
