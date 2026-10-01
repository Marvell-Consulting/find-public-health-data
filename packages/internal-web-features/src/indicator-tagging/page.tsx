import {
  TAG_LIST_DETAILS,
  type TagList,
  type TagOption,
  type TagOptions,
} from '@fphd/internal-api-features/contract';
import {
  Button,
  errorProp,
  fieldInputId,
  firstRadioId,
  QuestionLegend,
  Radios,
  Select,
} from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { addIntent, removeIntent } from '../list-form.ts';
import { ADD_TAG_FIELDS, type TaggingPageField, type TaggingPageValues } from './form.ts';

type FieldErrors = Partial<Record<TaggingPageField, string>>;

const RISK_FACTOR_QUESTION = 'Does this indicator include a risk factor?';
const FRAMEWORK_QUESTION = 'Is this indicator part of a framework or programme?';

// The order the error summary lists them in, which is the order the page asks.
const FIELDS: readonly TaggingPageField[] = [
  'topicIds',
  'addTopic',
  'indicatorTypeIds',
  'addIndicatorType',
  'hasRiskFactor',
  'riskFactorIds',
  'addRiskFactor',
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
}: {
  list: TagList;
  options: readonly TagOption[];
  values: TaggingPageValues;
  fieldErrors: FieldErrors;
}) {
  const { article, noun } = TAG_LIST_DETAILS[list];
  const field = ADD_TAG_FIELDS[list];
  const added = values[list].flatMap((id) => options.filter((option) => option.id === id));

  return (
    <div className="govuk-!-margin-bottom-6">
      {/* The select and its Add button side by side, as one control. */}
      <div className="fphd-field-row fphd-field-row--with-button">
        <Select
          // A list refused as a whole is shown on the select that adds to it.
          {...errorProp(fieldErrors[field] ?? fieldErrors[list])}
          defaultValue={values[field]}
          label={`Select ${article} ${noun}`}
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
  const picker = (list: TagList) => (
    <TagPicker
      fieldErrors={fieldErrors}
      list={list}
      options={options[TAG_LIST_DETAILS[list].options]}
      values={values}
    />
  );

  return (
    <IndicatorSectionForm
      continueOnEnter
      fieldIds={{
        topicIds: fieldInputId('addTopic'),
        indicatorTypeIds: fieldInputId('addIndicatorType'),
        hasRiskFactor: firstRadioId('hasRiskFactor'),
        riskFactorIds: fieldInputId('addRiskFactor'),
        hasFramework: firstRadioId('hasFramework'),
        frameworkIds: fieldInputId('addFramework'),
      }}
      fields={FIELDS}
      form={form}
      title="Add tags for this indicator"
    >
      {picker('topicIds')}
      {picker('indicatorTypeIds')}
      <Radios
        {...errorProp(fieldErrors.hasRiskFactor)}
        defaultValue={values.hasRiskFactor}
        label={<QuestionLegend>{RISK_FACTOR_QUESTION}</QuestionLegend>}
        name="hasRiskFactor"
        options={[
          // Shown without JavaScript; with it, only while "Yes" is chosen.
          { label: 'Yes', value: 'yes', conditional: picker('riskFactorIds') },
          { label: 'No', value: 'no' },
        ]}
      />
      <Radios
        {...errorProp(fieldErrors.hasFramework)}
        defaultValue={values.hasFramework}
        label={<QuestionLegend>{FRAMEWORK_QUESTION}</QuestionLegend>}
        name="hasFramework"
        options={[
          { label: 'Yes', value: 'yes', conditional: picker('frameworkIds') },
          { label: 'No', value: 'no' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
