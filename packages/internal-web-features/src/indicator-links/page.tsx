import type { IndicatorLink } from '@fphd/internal-api-features/contract';
import { Button, fieldInputId, firstRadioId, Radios, TextInput } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import {
  type LinksPageField,
  type LinksPageValues,
  linkFieldName,
  removeLinkIntent,
} from './form.ts';

const LINKS_QUESTION =
  'Are there any relevant links to help users understand this indicator better?';

// The order the error summary lists them in, which is the order the page asks.
const FIELDS: readonly LinksPageField[] = ['hasLinks', 'linkUrl', 'linkText', 'links'];

/**
 * The links added so far, each carried in hidden fields until Continue saves them. The list
 * follows the Add button, so Enter in a field adds rather than removing the first link.
 */
function AddedLinks({ links }: { links: readonly IndicatorLink[] }) {
  if (links.length === 0) return null;

  return (
    <ul className="fphd-added-list">
      {links.map(({ text, url }, index) => (
        <li className="fphd-added-list__item" key={url}>
          <input name={linkFieldName(index, 'url')} type="hidden" value={url} />
          <input name={linkFieldName(index, 'text')} type="hidden" value={text} />
          {/* A new tab, so following it keeps the links not yet saved. */}
          <a className="govuk-link" href={url} rel="noreferrer" target="_blank">
            {text} (opens in new tab)
          </a>
          <Button
            classModifiers="secondary"
            className="govuk-!-margin-bottom-0"
            name="intent"
            value={removeLinkIntent(index)}
          >
            {'Remove '}
            <span className="govuk-visually-hidden">link {text}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function LinksPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<LinksPageField, LinksPageValues>) {
  const { hasLinks: hasLinksError, linkText: linkTextError } = fieldErrors;
  // "Yes" with no links is asked of the URL field, where the next link goes.
  const linkUrlError = fieldErrors.linkUrl ?? fieldErrors.links;

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ hasLinks: firstRadioId('hasLinks'), links: fieldInputId('linkUrl') }}
      fields={FIELDS}
      questionIsHeading
      title={LINKS_QUESTION}
    >
      <Radios
        {...(hasLinksError === undefined ? {} : { error: hasLinksError })}
        defaultValue={values.hasLinks}
        hint="For example, any statistical commentaries that will be available once this indicator is published"
        label={<h1>{LINKS_QUESTION}</h1>}
        name="hasLinks"
        options={[
          {
            label: 'Yes',
            value: 'yes',
            // Shown without JavaScript; with it, only while "Yes" is chosen.
            conditional: (
              <>
                <TextInput
                  autoComplete="off"
                  defaultValue={values.linkUrl}
                  error={linkUrlError}
                  inputMode="url"
                  label="Add link URL"
                  name="linkUrl"
                  spellCheck={false}
                />
                <TextInput
                  autoComplete="off"
                  defaultValue={values.linkText}
                  error={linkTextError}
                  label="Add link text"
                  name="linkText"
                />
                <Button
                  classModifiers="secondary"
                  className="govuk-!-margin-top-3 govuk-!-margin-bottom-0"
                  name="intent"
                  value="add"
                >
                  Add link
                </Button>
                <AddedLinks links={values.links} />
              </>
            ),
          },
          { label: 'No', value: 'no' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
