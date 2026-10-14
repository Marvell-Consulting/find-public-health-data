import { requireApiSession } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import { indicatorIdSchema } from './contract.ts';
import {
  type DataTableCheck,
  type DataTableConfirmationError,
  type DataTableConfirmed,
  dataTableConfirmationSchema,
  dataTablePageQuerySchema,
} from './data-table-check-contract.ts';
import { type IndicatorTeams, requireIndicatorEditor } from './indicator-editor.ts';
import type { InternalDataUploadRepository } from './repositories.ts';

/** The draft's loaded data table, a page at a time, and the publisher's confirmation of it. */
export function dataTableCheckRouter(
  dataUploads: InternalDataUploadRepository,
  indicators: IndicatorTeams,
  session: JwtSessionVerifier,
): Router {
  const router = Router();
  const requireEditor = requireIndicatorEditor(session, indicators);

  router.get(
    '/api/internal/indicators/:id/data-table',
    requireEditor,
    async (request, response) => {
      const id = indicatorIdSchema.safeParse(request.params.id);

      if (!id.success) {
        response.status(400).json({ error: 'invalid_id' });
        return;
      }

      const query = dataTablePageQuerySchema.safeParse(request.query);

      if (!query.success) {
        response.status(400).json({ error: 'invalid_page' });
        return;
      }

      const found = await dataUploads.findDraftDataTable(id.data);

      // A published indicator is edited by opening a draft first, so until then there is no
      // data table to check.
      if (!found.found) {
        response.status(404).json({ error: found.reason });
        return;
      }

      const { page, rowsPerPage } = query.data;
      const { dataTable } = found;
      // A page past the last has no rows, so the batch is not read for it.
      const rows =
        dataTable === null || (page - 1) * rowsPerPage >= dataTable.rowCount
          ? []
          : await dataUploads.listRows(dataTable, page, rowsPerPage);
      const body: DataTableCheck = {
        dataTable: dataTable === null ? null : { ...dataTable, page, rowsPerPage, rows },
      };

      response.status(200).json(body);
    },
  );

  router.put(
    '/api/internal/indicators/:id/data-table/confirmation',
    requireEditor,
    async (request, response) => {
      const id = indicatorIdSchema.safeParse(request.params.id);

      if (!id.success) {
        response.status(400).json({ error: 'invalid_id' } satisfies DataTableConfirmationError);
        return;
      }

      const submission = dataTableConfirmationSchema.safeParse(request.body);

      if (!submission.success) {
        response
          .status(400)
          .json({ error: 'validation_failed' } satisfies DataTableConfirmationError);
        return;
      }

      const { sub } = requireApiSession(response);
      const { batchId } = submission.data;
      const result = await dataUploads.confirm(id.data, batchId, sub);

      if (!result.ok) {
        if (result.reason === 'data_table_changed') {
          response.status(409).json({ error: result.reason } satisfies DataTableConfirmationError);
        } else {
          response.status(404).json({ error: result.reason });
        }
        return;
      }

      request.log.info({ indicatorId: id.data, uploadBatchId: batchId }, 'Data table confirmed');
      response.status(200).json({
        confirmedAt: result.confirmedAt.toISOString(),
      } satisfies DataTableConfirmed);
    },
  );

  return router;
}
