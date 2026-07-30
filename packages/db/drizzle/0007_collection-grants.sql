-- Explicit per-table grants, matching 0003: a table added by a migration gets no
-- access until that migration grants it deliberately.
GRANT SELECT ON collection TO public_api;--> statement-breakpoint
GRANT SELECT ON collection TO internal_api;--> statement-breakpoint
GRANT SELECT ON indicator_collection TO public_api;--> statement-breakpoint
GRANT SELECT ON indicator_collection TO internal_api;
