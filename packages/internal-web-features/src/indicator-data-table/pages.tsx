import { dataTableFileRefusal } from '@fphd/internal-api-features/contract';
import {
  Button,
  DocumentTitle,
  ErrorMessage,
  ErrorSummary,
  fieldInputId,
  GridColumn,
  GridRow,
  Input,
  initNewErrorSummaries,
  Label,
  Table,
} from '@fphd/ui';
import { type FormEvent, useEffect, useState } from 'react';

import { indicatorDataTablePath } from '../publish-paths.ts';
import type { DataTableProblem, DataTableUploadFailure } from './loader.ts';
import { problemRows } from './problem-content.tsx';

const FIELD = 'dataTable';
const ERROR_ID = `${FIELD}-error`;
const UPLOAD_HEADING = 'Upload indicator data table';
const UPLOADING = 'Uploading and checking your data table. This can take a few minutes.';

/**
 * Says the upload is under way once Continue is pressed, as a large file takes a while to send
 * and check. Without JavaScript the browser's own progress shows instead.
 */
function useUploading(): [boolean, () => void] {
  const [uploading, setUploading] = useState(false);

  // A page restored from the back-forward cache keeps its state, so it would still say so.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setUploading(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return [uploading, () => setUploading(true)];
}

/** The browser's own refusal of the chosen file, counted so each one is announced afresh. */
function useBrowserRefusal(): [
  { message: string; count: number } | undefined,
  (message: string | undefined) => void,
] {
  const [refusal, setRefusal] = useState<{ message: string; count: number }>();

  useEffect(() => {
    if (refusal !== undefined) void initNewErrorSummaries();
  }, [refusal]);

  return [
    refusal,
    (message) =>
      setRefusal((last) =>
        message === undefined ? undefined : { message, count: (last?.count ?? 0) + 1 },
      ),
  ];
}

interface UploadDataTablePageProps {
  fieldErrors?: DataTableUploadFailure['fieldErrors'] | undefined;
  formError?: string | undefined;
}

// The heading is the field's label, as GOV.UK asks of a page with a single question, which
// FileUpload cannot do; upstream: daniel-ac-martin/NotGovUK#2057.
export function UploadDataTablePage({ fieldErrors = {}, formError }: UploadDataTablePageProps) {
  const [uploading, startUploading] = useUploading();
  const [refusal, refuse] = useBrowserRefusal();
  // Once a file is on its way, the last refusal no longer applies.
  const error = uploading ? undefined : (refusal?.message ?? fieldErrors[FIELD]);
  const shownFormError = uploading || refusal !== undefined ? undefined : formError;
  const inputId = fieldInputId(FIELD);

  // The browser refuses what the API would, before sending a file it would only send back.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const input = event.currentTarget.elements.namedItem(FIELD);
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    const message = dataTableFileRefusal(file ?? { name: '', size: 0 });

    if (message === undefined) {
      refuse(undefined);
      startUploading();
    } else {
      event.preventDefault();
      refuse(message);
    }
  };

  return (
    <>
      <DocumentTitle
        hasErrors={error !== undefined || shownFormError !== undefined}
        pageTitle={UPLOAD_HEADING}
      />
      <ErrorSummary
        // A new summary for each refusal, so GOV.UK Frontend sets it up and focuses it again.
        key={refusal?.count ?? 'server'}
        errors={error === undefined ? [] : [{ name: FIELD, message: error }]}
        formError={shownFormError}
      />
      <GridRow>
        <GridColumn width="two-thirds">
          {/* A plain form posting back to its own page, so it works without JavaScript. */}
          <form method="post" encType="multipart/form-data" onSubmit={submit}>
            <div
              className={`govuk-form-group${error === undefined ? '' : ' govuk-form-group--error'}`}
            >
              <h1 className="govuk-label-wrapper">
                <Label classModifiers="xl" htmlFor={inputId}>
                  {UPLOAD_HEADING}
                </Label>
              </h1>
              {error === undefined ? null : <ErrorMessage id={ERROR_ID}>{error}</ErrorMessage>}
              <Input
                accept=".csv"
                aria-describedby={error === undefined ? undefined : ERROR_ID}
                classBlock="govuk-file-upload"
                classModifiers={error === undefined ? [] : 'error'}
                id={inputId}
                name={FIELD}
                type="file"
              />
            </div>
            <Button type="submit">Continue</Button>
            <p className="govuk-body" role="status">
              {uploading ? UPLOADING : null}
            </p>
          </form>
        </GridColumn>
      </GridRow>
    </>
  );
}

export const PROBLEMS_HEADING = 'There is a problem with the indicator data table you uploaded';

export function DataTableProblemsPage({
  id,
  problems,
}: {
  id: string;
  problems: readonly DataTableProblem[];
}) {
  return (
    <GridRow>
      <GridColumn width="two-thirds">
        <h1 className="govuk-heading-xl">{PROBLEMS_HEADING}</h1>
        <Table
          headings={{ problem: 'Problem', detail: 'Detail', actions: 'Actions' }}
          keys={['problem', 'detail', 'actions']}
          data={problemRows(problems).map(({ problem, detail, actions }) => ({
            // The first column is a row header, which GOV.UK sets bold; the problems read as
            // plain text, as the design has them.
            problem: <span className="govuk-!-font-weight-regular">{problem}</span>,
            detail,
            actions: (
              <>
                <p className="govuk-body">You should either:</p>
                <ul className="govuk-list govuk-list--bullet">
                  {actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </>
            ),
          }))}
        />
        <Button href={indicatorDataTablePath(id)}>Upload different or corrected data table</Button>
      </GridColumn>
    </GridRow>
  );
}
