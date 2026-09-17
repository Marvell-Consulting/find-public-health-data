CREATE SEQUENCE "public"."indicator_number_seq" INCREMENT BY 1 MINVALUE 1000000 MAXVALUE 9223372036854775807 START WITH 1000000 CACHE 1;--> statement-breakpoint
CREATE TABLE "indicator_alias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_canonical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indicator_alias_slug_unique" UNIQUE("slug"),
	CONSTRAINT "indicator_alias_canonical_published_check" CHECK (NOT "indicator_alias"."is_canonical" OR "indicator_alias"."is_published"),
	CONSTRAINT "indicator_alias_canonical_slug_check" CHECK (NOT "indicator_alias"."is_canonical" OR "indicator_alias"."slug" !~ '^[0-9]+$'),
	CONSTRAINT "indicator_alias_slug_check" CHECK ("indicator_alias"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_fingertipsId_unique";--> statement-breakpoint
ALTER TABLE "indicator_alias" ADD CONSTRAINT "indicator_alias_indicator_id_indicator_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_indicator_alias_number" ON "indicator_alias" USING btree ("indicator_id") WHERE "indicator_alias"."slug" ~ '^[0-9]+$';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_indicator_alias_canonical" ON "indicator_alias" USING btree ("indicator_id") WHERE "indicator_alias"."is_canonical";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_indicator_alias_pending" ON "indicator_alias" USING btree ("indicator_id") WHERE "indicator_alias"."slug" !~ '^[0-9]+$' AND NOT "indicator_alias"."is_published";--> statement-breakpoint
-- Every existing indicator keeps its Fingertips number as its number alias, and gains a
-- canonical slug from its name. slugify() in @fphd/config, in SQL: lowercase, whitespace
-- runs to one hyphen, anything outside the slug alphabet dropped, hyphens collapsed and
-- trimmed, and a digits-only result suffixed so it cannot read as a number. Two names that
-- slugify alike are separated by the number; a name with no slug in it at all fails the
-- slug check rather than being published under an address nobody can type.
INSERT INTO "indicator_alias" ("indicator_id", "slug", "is_published", "is_canonical")
SELECT "id", "fingertips_id"::text, true, false FROM "indicator";--> statement-breakpoint
INSERT INTO "indicator_alias" ("indicator_id", "slug", "is_published", "is_canonical")
SELECT
  "id",
  CASE WHEN "position" = 1 THEN "slug" ELSE "slug" || '-' || "fingertips_id" END,
  true,
  true
FROM (
  SELECT
    "id",
    "fingertips_id",
    "slug",
    row_number() OVER (PARTITION BY "slug" ORDER BY "fingertips_id") AS "position"
  FROM (
    SELECT
      "id",
      "fingertips_id",
      CASE WHEN "slug" ~ '^[0-9]+$' THEN "slug" || '-indicator' ELSE "slug" END AS "slug"
    FROM (
      SELECT
        "id",
        "fingertips_id",
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower("name"), '\s+', '-', 'g'),
              '[^a-z0-9-]', '', 'g'),
            '-{2,}', '-', 'g'),
          '^-|-$', '', 'g') AS "slug"
      FROM "indicator"
    ) AS "slugged"
  ) AS "suffixed"
) AS "ranked";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "fingertips_id";--> statement-breakpoint
-- Explicit per-table grants, matching 0003. The publisher mints numbers from the sequence
-- and writes aliases; the public API only reads them.
GRANT SELECT ON indicator_alias TO public_api;--> statement-breakpoint
GRANT SELECT ON indicator_alias TO internal_api;--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON indicator_alias TO internal_api;--> statement-breakpoint
GRANT USAGE ON SEQUENCE indicator_number_seq TO internal_api;
