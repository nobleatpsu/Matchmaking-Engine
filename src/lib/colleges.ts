import type { Database } from '@shared/types';

/** Colleges present in the workspace's departments, sorted. */
export const collegesOf = (db: Pick<Database, 'departments'>) => [...new Set(Object.values(db.departments).map((d) => d.college))].sort();
