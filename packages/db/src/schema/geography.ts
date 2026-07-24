import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const areaType = pgTable(
  'area_type',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull().unique(),
    hierarchyType: text().notNull(),
    level: integer().notNull(),
  },
  (t) => [
    check('area_type_hierarchy_type_check', sql`${t.hierarchyType} IN ('NHS', 'Administrative')`),
  ],
);

// The EXCLUDE USING gist constraint preventing overlapping validity ranges per area
// code cannot be expressed by Drizzle's schema API; it lives in a custom migration.
export const area = pgTable(
  'area',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull(),
    name: text().notNull(),
    areaTypeId: integer()
      .notNull()
      .references(() => areaType.id),
    validFrom: date().notNull(),
    validTo: date(),
  },
  (t) => [
    index('idx_area_code').on(t.code),
    index('idx_area_code_validity').on(t.code, t.validFrom, t.validTo),
    index('idx_area_type').on(t.areaTypeId),
    index('idx_area_validity').on(t.areaTypeId, t.validFrom, t.validTo),
  ],
);

export const areaRelationship = pgTable(
  'area_relationship',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    parentAreaId: integer()
      .notNull()
      .references(() => area.id),
    childAreaId: integer()
      .notNull()
      .references(() => area.id),
    validFrom: date().notNull(),
    validTo: date(),
  },
  (t) => [
    index('idx_area_rel_parent').on(t.parentAreaId),
    index('idx_area_rel_child').on(t.childAreaId),
  ],
);
