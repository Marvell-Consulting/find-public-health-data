ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_published_at_check" CHECK (("indicator_version"."status" = 'published') = ("indicator_version"."published_at" IS NOT NULL));--> statement-breakpoint
CREATE VIEW "public"."current_published_version" AS (select distinct on ("indicator_version"."indicator_id") "id", "indicator_id", "status", "published_at", "name", "slug", "value_type_id", "unit_id", "year_type_id", "ci_method_id", "polarity_id", "frequency_id", "comparator_method_id", "disclosure_threshold", "ci_confidence_level", "config", "definition", "rationale", "methodology", "numerator_definition", "denominator_definition", "disclosure_control", "caveats", "notes", "data_source_id", "numerator_source_id", "denominator_source_id", "created_at", "updated_at", "created_by", "updated_by" from "indicator_version" where "indicator_version"."status" = 'published' order by "indicator_version"."indicator_id" asc, "indicator_version"."published_at" desc, "indicator_version"."id" desc);--> statement-breakpoint
-- The internal reads join it; public_api keeps reading the published views alone.
GRANT SELECT ON current_published_version TO internal_api;--> statement-breakpoint

-- The published views restate nothing: they join the view above. Replaced in place, so the
-- column lists and the grants on them stand.
CREATE OR REPLACE VIEW published.indicator AS
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
JOIN current_published_version v ON v.indicator_id = i.id
CROSS JOIN LATERAL (
  SELECT min(pv.published_at) AS first_published_at, max(pv.published_at) AS last_published_at
  FROM indicator_version pv
  WHERE pv.indicator_id = i.id
) p;--> statement-breakpoint

CREATE OR REPLACE VIEW published.indicator_topic AS
SELECT v.indicator_id, it.topic_id
FROM current_published_version v
JOIN indicator_topic it ON it.indicator_version_id = v.id;--> statement-breakpoint

CREATE OR REPLACE VIEW published.indicator_classification AS
SELECT v.indicator_id, ic.classification_id
FROM current_published_version v
JOIN indicator_classification ic ON ic.indicator_version_id = v.id;
