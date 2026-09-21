ALTER TABLE "indicator_version" ADD COLUMN "slug" text;--> statement-breakpoint
-- Rows written before the column have no name-derived slug and the seed carries the real
-- ones, so they take a placeholder that only has to be unique to their indicator.
UPDATE "indicator_version" v SET "slug" = 'indicator-' || i.short_id
FROM "indicator" i WHERE i.id = v.indicator_id;--> statement-breakpoint
ALTER TABLE "indicator_version" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_indicator_version_slug" ON "indicator_version" USING btree ("slug");--> statement-breakpoint

-- A slug belongs to one indicator for ever: versions of one indicator share it, two
-- indicators never do. A draft therefore reserves its slug until it is deleted.
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_slug_indicator_excl" EXCLUDE USING gist (
  slug WITH =,
  indicator_id WITH <>
);--> statement-breakpoint

-- published.indicator gains the canonical slug — the latest published version's. Dropped
-- and recreated rather than replaced so the column sits beside the name it derives from;
-- a drop takes the view's grants with it, so they are made again below.
DROP VIEW published.indicator;--> statement-breakpoint
CREATE VIEW published.indicator AS
SELECT
  i.id,
  i.short_id,
  i.data_updated_at,
  i.created_at,
  v.name,
  v.slug,
  v.value_type_id,
  v.unit_id,
  v.year_type_id,
  v.ci_method_id,
  v.polarity_id,
  v.frequency_id,
  v.comparator_method_id,
  v.disclosure_threshold,
  v.ci_confidence_level,
  v.config,
  v.definition,
  v.rationale,
  v.methodology,
  v.numerator_definition,
  v.denominator_definition,
  v.disclosure_control,
  v.caveats,
  v.notes,
  v.data_source_id,
  v.numerator_source_id,
  v.denominator_source_id,
  v.updated_at,
  p.first_published_at,
  p.last_published_at
FROM indicator i
JOIN (
  SELECT DISTINCT ON (cv.indicator_id) cv.*
  FROM indicator_version cv
  WHERE cv.status = 'published'
  ORDER BY cv.indicator_id, cv.published_at DESC NULLS LAST, cv.id DESC
) v ON v.indicator_id = i.id
CROSS JOIN LATERAL (
  SELECT min(pv.published_at) AS first_published_at, max(pv.published_at) AS last_published_at
  FROM indicator_version pv
  WHERE pv.indicator_id = i.id
) p;--> statement-breakpoint

-- Every slug a published version carries, so an indicator's earlier addresses still
-- resolve to it. The public role reads this rather than the version table.
CREATE VIEW published.indicator_slug AS
SELECT DISTINCT v.slug, v.indicator_id
FROM indicator_version v
WHERE v.status = 'published';--> statement-breakpoint

GRANT SELECT ON published.indicator TO public_api;--> statement-breakpoint
GRANT SELECT ON published.indicator TO internal_api;--> statement-breakpoint
GRANT SELECT ON published.indicator_slug TO public_api;--> statement-breakpoint
GRANT SELECT ON published.indicator_slug TO internal_api;
