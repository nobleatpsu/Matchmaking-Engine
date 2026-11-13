import type { Database, Op } from './types';

/** Apply ops to an in-memory database (immutable). Used by the client store and tests. */
export function applyLocalOps(db: Database, ops: Op[]): Database {
  const next = { ...db } as Database;
  const touched = new Set<string>();
  for (const op of ops) {
    if (!touched.has(op.collection)) {
      (next as unknown as Record<string, unknown>)[op.collection] = { ...(db as unknown as Record<string, Record<string, unknown>>)[op.collection] };
      touched.add(op.collection);
    }
    const coll = (next as unknown as Record<string, Record<string, unknown>>)[op.collection];
    if (op.op === 'put') coll[op.record.id] = op.record;
    else delete coll[op.id];
  }
  return next;
}
