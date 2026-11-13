import type { MatchCorpus } from '@shared/matching/types';
import type { Database } from '@shared/types';

export function corpusOf(db: Database): MatchCorpus {
  return {
    faculty: Object.values(db.faculty),
    departments: db.departments,
    projects: Object.values(db.projects),
    publications: Object.values(db.publications),
    ip: Object.values(db.ip),
  };
}
