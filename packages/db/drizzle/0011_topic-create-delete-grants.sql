-- Publisher topic create and delete (internal only): internal_api had SELECT and UPDATE.
-- Table-level INSERT and DELETE on topic, plus DELETE on indicator_topic so a topic can be
-- removed together with the links that reference it — the write does both in one transaction.
GRANT INSERT, DELETE ON topic TO internal_api;--> statement-breakpoint
GRANT DELETE ON indicator_topic TO internal_api;
