// Topological FK order: every table loads after the tables it references.
// Self-references (dimension_value.parent_id etc.) resolve within a single COPY
// because FK checks run at end of statement. The files carry ci_method, comparator_method and
// numerator_denominator_source, but the service's lists are core data: the source's rows are
// read only to point its versions at ours. The value types and units are core data too, and
// the versions already carry their ids.
export const SEED_TABLES = [
  'ci_method',
  'comparator_method',
  'data_source',
  'numerator_denominator_source',
  'dimension_type',
  'dimension_value',
  'area_type',
  'area',
  'area_relationship',
  'indicator',
  'indicator_version',
  'upload_batch',
  'note_type',
  'observation',
  'observation_dimension',
  'observation_note',
] as const;
