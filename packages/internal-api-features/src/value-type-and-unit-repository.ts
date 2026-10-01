import { type Database, schema } from '@fphd/db';
import { asc } from 'drizzle-orm';

import type { ValueTypeAndUnitOptions } from './contract.ts';

const { unit, valueType } = schema;

/** Every value type and unit, each in the order the publisher's form lists them. */
export async function listValueTypeAndUnitOptions(db: Database): Promise<ValueTypeAndUnitOptions> {
  const [valueTypes, units] = await Promise.all([
    db
      .select({ id: valueType.id, name: valueType.name })
      .from(valueType)
      .orderBy(asc(valueType.position), asc(valueType.name)),
    db
      .select({ id: unit.id, name: unit.name })
      .from(unit)
      .orderBy(asc(unit.position), asc(unit.name)),
  ]);

  return { valueTypes, units };
}
