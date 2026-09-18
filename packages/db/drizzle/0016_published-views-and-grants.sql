-- The public read surface becomes the `published` schema. Every predicate that hides an
-- unpublished indicator lives in a view definition, so no query has to remember it.
-- Ordinary views, owned by the migration role: public_api reads through the owner's
-- privileges and holds none of its own on the tables underneath.
CREATE VIEW published.indicator AS
SELECT
  i.id,
  i.short_id,
  i.data_updated_at,
  i.created_at,
  v.name,
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
JOIN indicator_version v ON v.indicator_id = i.id AND v.status = 'published'
CROSS JOIN LATERAL (
  SELECT min(pv.published_at) AS first_published_at, max(pv.published_at) AS last_published_at
  FROM indicator_version pv
  WHERE pv.indicator_id = i.id
) p;--> statement-breakpoint

CREATE VIEW published.indicator_topic AS
SELECT v.indicator_id, it.topic_id
FROM indicator_topic it
JOIN indicator_version v ON v.id = it.indicator_version_id AND v.status = 'published';--> statement-breakpoint

CREATE VIEW published.indicator_classification AS
SELECT v.indicator_id, ic.classification_id
FROM indicator_classification ic
JOIN indicator_version v ON v.id = ic.indicator_version_id AND v.status = 'published';--> statement-breakpoint

-- The indicator-level predicate holds whatever the data plan later does with row-level
-- publication state: an indicator with no published version exposes no observations.
CREATE VIEW published.observation AS
SELECT
  o.id,
  o.indicator_id,
  o.area_id,
  o.from_date,
  o.to_date,
  o.value,
  o.count,
  o.denominator,
  o.denominator_2,
  o.lower_ci_95,
  o.upper_ci_95,
  o.lower_ci_998,
  o.upper_ci_998,
  o.distribution_rank,
  o.published_at,
  o.upload_batch_id,
  o.created_at
FROM observation o
WHERE o.deleted_at IS NULL
  AND o.indicator_id IN (SELECT indicator_id FROM indicator_version WHERE status = 'published');--> statement-breakpoint

CREATE VIEW published.observation_dimension AS
SELECT od.id, od.observation_id, od.dimension_value_id, od.dimension_type_id
FROM observation_dimension od
WHERE EXISTS (SELECT 1 FROM published.observation o WHERE o.id = od.observation_id);--> statement-breakpoint

CREATE VIEW published.observation_note AS
SELECT onote.id, onote.observation_id, onote.note_type_id
FROM observation_note onote
WHERE EXISTS (SELECT 1 FROM published.observation o WHERE o.id = onote.observation_id);--> statement-breakpoint

CREATE VIEW published.latest_headline AS
SELECT lh.*
FROM latest_headline lh
WHERE lh.indicator_id IN (SELECT indicator_id FROM indicator_version WHERE status = 'published');--> statement-breakpoint

CREATE VIEW published.available_data AS
SELECT ad.*
FROM available_data ad
WHERE ad.indicator_id IN (SELECT indicator_id FROM indicator_version WHERE status = 'published');--> statement-breakpoint

CREATE VIEW published.indicator_dimension_values AS
SELECT idv.*
FROM indicator_dimension_values idv
WHERE idv.indicator_id IN (SELECT indicator_id FROM indicator_version WHERE status = 'published');--> statement-breakpoint

CREATE VIEW published.observation_range AS
SELECT orng.*
FROM observation_range orng
WHERE orng.indicator_id IN (SELECT indicator_id FROM indicator_version WHERE status = 'published');--> statement-breakpoint

-- Reference data is not versioned by this plan, so these pass through. They exist so the
-- public role has one kind of object to read, and so registry versioning can later change
-- a definition without touching a grant.
CREATE VIEW published.value_type AS SELECT * FROM value_type;--> statement-breakpoint
CREATE VIEW published.unit AS SELECT * FROM unit;--> statement-breakpoint
CREATE VIEW published.year_type AS SELECT * FROM year_type;--> statement-breakpoint
CREATE VIEW published.ci_method AS SELECT * FROM ci_method;--> statement-breakpoint
CREATE VIEW published.polarity AS SELECT * FROM polarity;--> statement-breakpoint
CREATE VIEW published.frequency AS SELECT * FROM frequency;--> statement-breakpoint
CREATE VIEW published.comparator_method AS SELECT * FROM comparator_method;--> statement-breakpoint
CREATE VIEW published.data_source AS SELECT * FROM data_source;--> statement-breakpoint
CREATE VIEW published.numerator_denominator_source AS SELECT * FROM numerator_denominator_source;--> statement-breakpoint
CREATE VIEW published.dimension_type AS SELECT * FROM dimension_type;--> statement-breakpoint
CREATE VIEW published.dimension_value AS SELECT * FROM dimension_value;--> statement-breakpoint
CREATE VIEW published.area_type AS SELECT * FROM area_type;--> statement-breakpoint
CREATE VIEW published.area AS SELECT * FROM area;--> statement-breakpoint
CREATE VIEW published.area_relationship AS SELECT * FROM area_relationship;--> statement-breakpoint
CREATE VIEW published.note_type AS SELECT * FROM note_type;--> statement-breakpoint
CREATE VIEW published.topic AS SELECT * FROM topic;--> statement-breakpoint
CREATE VIEW published.classification AS SELECT * FROM classification;--> statement-breakpoint

-- public_api keeps no privilege of its own in `public`: a future table granted to it there
-- is a mistake, and the grants test fails on it.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public_api;--> statement-breakpoint
GRANT USAGE ON SCHEMA published TO public_api;--> statement-breakpoint
GRANT USAGE ON SCHEMA published TO internal_api;--> statement-breakpoint
-- internal-api mounts the public routes, so it reads the same views.
GRANT SELECT ON ALL TABLES IN SCHEMA published TO public_api;--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA published TO internal_api;--> statement-breakpoint
-- The publisher writes: whole tables, as the existing write grants are.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  indicator, indicator_version, indicator_topic, indicator_classification
TO internal_api;
