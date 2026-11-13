/**
 * Reference data for a brand-new LIVE workspace: departments and the list of
 * data sources the platform knows how to describe. No people, companies or
 * research records — those come from imports, the ingestion API and staff.
 */
import type { DataSource, Database, Department } from '../types';
import { COLLECTIONS } from '../types';
import { departments } from './people';

export const liveSources = (now: string): DataSource[] => [
  { id: 'src-manual', name: 'Staff-entered records', kind: 'manual', provider: 'manual', status: 'manual', owner: 'CEC / OTT staff', recordTypes: ['Any'], description: 'Information typed directly into the platform.', accessNote: 'Always attributed to the person who entered it.', lastSync: now },
  { id: 'src-import', name: 'CSV imports', kind: 'import', provider: 'csv', status: 'manual', owner: 'Any staff member', recordTypes: ['Faculty', 'Companies', 'Projects', 'Publications', 'IP'], description: 'Spreadsheets uploaded through Data Health → Import.', accessNote: 'Imported rows are marked unverified until checked.' },
  { id: 'src-api', name: 'Ingestion API', kind: 'api', provider: 'api', status: 'not-connected', owner: 'Data team', recordTypes: ['Any'], description: 'Records pushed by scripts and scrapers via POST /api/w/live/ingest with an API key.', accessNote: 'Create an API key in Admin → API keys. See docs/data-ingestion.md.' },
  { id: 'src-directory', name: 'Faculty directories', kind: 'faculty-directory', provider: 'none', status: 'not-connected', owner: 'Data team', recordTypes: ['Faculty'], description: 'Public department faculty pages.', accessNote: 'Implement a DataProvider or push through the ingestion API.' },
  { id: 'src-openalex', name: 'OpenAlex (publications)', kind: 'publication-db', provider: 'openalex', status: 'not-connected', owner: 'Data team', recordTypes: ['Publications'], description: 'Open scholarly index. Pulls works for faculty with an ORCID or OpenAlex id.', accessNote: 'Run `npm run sync -- --provider=openalex --workspace=live`. No key required; set OPENALEX_MAILTO.' },
  { id: 'src-records', name: 'University sponsored-projects records', kind: 'university-records', provider: 'none', status: 'awaiting-access', owner: 'Research Office', recordTypes: ['Projects', 'Relationships'], description: 'Awarded projects, sponsors, dates.', accessNote: 'Access not yet requested.' },
  { id: 'src-ott', name: 'OTT technology portfolio', kind: 'ott', provider: 'none', status: 'awaiting-access', owner: 'Office of Technology Transfer', recordTypes: ['IP'], description: 'Disclosures, filings, licensing status.', accessNote: 'To be agreed with OTT.' },
];

export function buildLiveSeed(now = new Date()): Database {
  const db = Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as Database;
  const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));
  db.departments = byId<Department>(departments);
  db.sources = byId(liveSources(now.toISOString()));
  return db;
}
