/**
 * The ingestion contract — what scrapers, scripts and data providers send.
 *
 * These shapes are deliberately simpler than the stored records: you send what
 * you know, and the sync engine (server/ingest.ts) matches it to existing
 * records, fills defaults, attaches provenance, links faculty, detects
 * conflicts and (optionally) emits signals.
 *
 * Endpoint:  POST /api/w/{workspace}/ingest      body: IngestBatch
 * CLI:       npm run ingest -- --file=batch.json --workspace=live
 * Docs:      docs/data-ingestion.md
 */
import type { ExternalIds, ISODate } from './types';

export type IngestEntity = 'departments' | 'faculty' | 'companies' | 'interests' | 'projects' | 'publications' | 'ip' | 'signals';
export const INGEST_ENTITIES: IngestEntity[] = ['departments', 'faculty', 'companies', 'interests', 'projects', 'publications', 'ip', 'signals'];

/** How to point at a researcher. Any one field is enough; more fields = safer matching. */
export interface FacultyRef {
  id?: string;
  externalIds?: ExternalIds; // e.g. { orcid: '0000-0002-...', openalex: 'A123', psu: 'abc123' }
  email?: string;
  name?: string; // last resort; must be unambiguous
}

export interface IngestDepartment { id?: string; name: string; college: string }

export interface IngestFaculty {
  id?: string;
  externalIds?: ExternalIds;
  name: string;
  title?: string;
  /** Department id or exact department name. Unknown names are created when `college` is given. */
  department?: string;
  college?: string;
  email?: string;
  emailVerified?: boolean;
  profileUrl?: string;
  summary?: string;
  /** Concept ids (see shared/taxonomy.ts) or free-text labels — labels are mapped to concepts. */
  expertise?: string[];
  keywords?: string[];
  labName?: string;
  labSize?: number;
  availability?: 'unknown' | 'open' | 'limited' | 'unavailable';
  interests?: { pathway: 'research' | 'talent' | 'engagement'; note: string; verified: boolean }[];
  /** Set when the source itself is authoritative and current (e.g. HR directory). */
  verifiedAt?: ISODate;
}

export interface IngestCompany {
  id?: string;
  externalIds?: ExternalIds;
  name: string;
  industry?: string;
  website?: string;
  hq?: string;
  size?: 'startup' | 'mid-size' | 'enterprise';
  description?: string;
  objectives?: string[];
  relationship?: 'prospect' | 'active' | 'dormant' | 'former';
}

export interface IngestInterest {
  id?: string;
  /** Company id, or exact company name. */
  company: string;
  pathway: 'research' | 'talent' | 'engagement';
  title: string;
  description?: string;
  topics?: string[];
  status?: 'open' | 'exploring' | 'paused' | 'fulfilled';
}

export interface IngestProject {
  id?: string;
  externalIds?: ExternalIds;
  title: string;
  description?: string;
  faculty: FacultyRef[];
  topics?: string[];
  start?: ISODate;
  end?: ISODate;
  status?: 'active' | 'completed' | 'unknown';
  sponsor?: string;
  fundingNote?: string;
  url?: string;
}

export interface IngestPublication {
  id?: string;
  externalIds?: ExternalIds;
  title: string;
  venue?: string;
  year: number;
  faculty: FacultyRef[];
  topics?: string[];
  doi?: string;
  url?: string;
}

export interface IngestIP {
  id?: string;
  externalIds?: ExternalIds;
  title: string;
  reference?: string;
  status?: 'disclosure' | 'provisional' | 'patent-pending' | 'issued' | 'unknown';
  licensing?: 'available' | 'optioned' | 'licensed' | 'unknown';
  faculty: FacultyRef[];
  summary?: string;
  applications?: string[];
  topics?: string[];
  filed?: ISODate;
  /** True only when the data comes from OTT itself. */
  verified?: boolean;
  url?: string;
}

export interface IngestSignal {
  externalIds?: ExternalIds;
  kind: 'new-project' | 'new-publication' | 'new-ip' | 'company-announcement' | 'company-focus-change' | 'funding-announcement' | 'new-interest' | 'record-updated';
  title: string;
  detail?: string;
  date?: ISODate;
  faculty?: FacultyRef[];
  companies?: { id?: string; name?: string }[];
  topics?: string[];
  suggestedAction?: string;
  url?: string;
}

export interface IngestBatch {
  entity: IngestEntity;
  /** Which data source this came from. Unknown ids are registered automatically. */
  source: { sourceId: string; label?: string; url?: string };
  records: unknown[];
  options?: {
    /** Validate and report without writing anything. */
    dryRun?: boolean;
    /** Create signals for new projects/publications/IP (default true, except CSV imports). */
    emitSignals?: boolean;
  };
}

export type IngestStatus = 'created' | 'updated' | 'unchanged' | 'conflict' | 'error';

export interface IngestReport {
  entity: IngestEntity;
  sourceId: string;
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  errors: number;
  signals: number;
  results: { index: number; status: IngestStatus; id?: string; name?: string; message?: string; conflicts?: { field: string; existing: string; incoming: string }[] }[];
}
