import {
  Button,
  DocumentTitle,
  ErrorMessage,
  ErrorSummary,
  fieldInputId,
  GridColumn,
  GridRow,
  Input,
  Label,
  Table,
} from '@fphd/ui';
import { useEffect, useState } from 'react';

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

// The heading is the field's label, as GOV.UK asks of a page with a single question, which
// FileUpload cannot do; upstream: daniel-ac-martin/NotGovUK#2057.
interface UploadDataTablePageProps {
  fieldErrors?: DataTableUploadFailure['fieldErrors'] | undefined;
  formError?: string | undefined;
}

export function UploadDataTablePage({ fieldErrors = {}, formError }: UploadDataTablePageProps) {
  const error = fieldErrors[FIELD];
  const inputId = fieldInputId(FIELD);
  const [uploading, startUploading] = useUploading();

  return (
    <>
      <DocumentTitle
        hasErrors={error !== undefined || formError !== undefined}
        pageTitle={UPLOAD_HEADING}
      />
      <ErrorSummary
        errors={error === undefined ? [] : [{ name: FIELD, message: error }]}
        formError={formError}
      />
      <GridRow>
        <GridColumn width="two-thirds">
          {/* A plain form posting back to its own page, so it works without JavaScript. */}
          <form method="post" encType="multipart/form-data" onSubmit={startUploading}>
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

const PROBLEMS_HEADING = 'There is a problem with the indicator data table you uploaded';

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
