/**
 * Runtime schemas for every stored record. The server validates every write
 * (UI transactions and the ingestion API) against these, so bad data from a
 * script or data provider is rejected with a readable error instead of
 * corrupting the database.
 *
 * Keep in sync with shared/types.ts. Unknown fields are stripped.
 */
import { z } from 'zod';
import type { CollectionName } from './types';

const id = z.string().min(1).max(120);
const iso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'must be an ISO date');
const text = (max = 20_000) => z.string().max(max);
const ids = z.array(id).max(500);
const externalIds = z.record(z.string(), z.string()).optional();
const provenance = z.record(z.string(), z.object({ sourceId: id, at: iso })).optional();
const sourceRef = z.object({ sourceId: id, label: text(300), url: z.string().max(2000).optional(), retrievedAt: iso });
const note = z.object({ id, authorId: id, at: iso, text: text() });
const pathway = z.enum(['research', 'talent', 'engagement']);
const priority = z.enum(['high', 'medium', 'low']);
const stage = z.enum(['new', 'discovery', 'matching', 'review', 'intro-prepared', 'intro-recorded', 'discussion', 'outcome', 'closed']);

export const userSchema = z.object({
  id, name: text(200).min(1), email: z.string().email().max(320), initials: text(4), title: text(200), team: text(100),
  role: z.enum(['viewer', 'staff', 'reviewer', 'admin']), active: z.boolean(), createdAt: iso.optional(), lastSeenAt: iso.optional(),
});

export const departmentSchema = z.object({ id, name: text(200).min(1), college: text(200).min(1) });

export const facultySchema = z.object({
  id, externalIds, provenance,
  name: text(200).min(1), title: text(200), departmentId: id, summary: text(),
  expertise: z.array(z.string()).max(50), keywords: z.array(text(200)).max(100),
  labName: text(200).optional(), labSize: z.number().int().min(0).max(1000).optional(),
  email: z.string().max(320).optional(), emailVerified: z.boolean(), profileUrl: z.string().max(2000).optional(),
  interests: z.array(z.object({ pathway, note: text(2000), verified: z.boolean() })).max(10),
  availability: z.enum(['unknown', 'open', 'limited', 'unavailable']),
  lastVerified: iso.optional(), sources: z.array(sourceRef).max(50), coverageNotes: z.array(text(1000)).max(20), saved: z.boolean().optional(),
});

export const companySchema = z.object({
  id, externalIds, provenance,
  name: text(300).min(1), industry: text(200), website: z.string().max(500).optional(), hq: text(200).optional(),
  size: z.enum(['startup', 'mid-size', 'enterprise']), description: text(), objectives: z.array(text(500)).max(30),
  relationship: z.enum(['prospect', 'active', 'dormant', 'former']), ownerId: id.optional(), notes: z.array(note).max(1000),
  createdAt: iso, lastTouch: iso.optional(), sources: z.array(sourceRef).max(50),
});

export const interestSchema = z.object({
  id, companyId: id, pathway, title: text(300).min(1), description: text(), topics: z.array(z.string()).max(30),
  status: z.enum(['open', 'exploring', 'paused', 'fulfilled']), createdAt: iso,
});

export const relationshipSchema = z.object({
  id, companyId: id, kind: z.enum(['sponsored-project', 'recruiting', 'license', 'membership', 'event', 'advisory']),
  title: text(300), description: text(), since: iso.optional(), until: iso.optional(), facultyIds: ids, departmentIds: ids,
  status: z.enum(['active', 'ended', 'unknown']), source: sourceRef,
});

export const projectSchema = z.object({
  id, externalIds, provenance, title: text(500).min(1), facultyIds: ids, description: text(), topics: z.array(z.string()).max(30),
  start: iso.optional(), end: iso.optional(), status: z.enum(['active', 'completed', 'unknown']),
  sponsor: text(300).optional(), fundingNote: text(1000).optional(), source: sourceRef,
});

export const publicationSchema = z.object({
  id, externalIds, provenance, title: text(1000).min(1), venue: text(500), year: z.number().int().min(1900).max(2100),
  facultyIds: ids, topics: z.array(z.string()).max(30), doi: z.string().max(300).optional(), source: sourceRef,
});

export const ipSchema = z.object({
  id, externalIds, provenance, title: text(500).min(1), reference: text(200).optional(),
  status: z.enum(['disclosure', 'provisional', 'patent-pending', 'issued', 'unknown']),
  licensing: z.enum(['available', 'optioned', 'licensed', 'unknown']),
  facultyIds: ids, summary: text(), applications: z.array(text(300)).max(30), topics: z.array(z.string()).max(30),
  filed: iso.optional(), verified: z.boolean(), source: sourceRef, flaggedForReview: z.boolean().optional(), linkedInterestIds: ids,
});

const matchRequest = z.object({
  text: text(), companyId: id.optional(), interestId: id.optional(), engagementType: z.enum(['research', 'talent', 'engagement', 'licensing']),
  topics: z.array(z.string()).max(50), excludedTopics: z.array(z.string()).max(50).optional(), disciplines: z.array(z.string()).max(20),
  outcome: text(2000).optional(), budget: text(500).optional(), timeline: text(500).optional(), location: text(500).optional(),
  constraints: z.object({ requireIP: z.boolean().optional(), requireVerifiedContact: z.boolean().optional(), activeResearchOnly: z.boolean().optional(), excludeFacultyIds: ids.optional() }),
  notes: text().optional(),
});
export const matchRequestSchema = matchRequest;

export const searchSchema = z.object({
  id, title: text(500), request: matchRequest, providerId: text(100), createdAt: iso, createdBy: id,
  candidates: z.array(z.object({ facultyId: id, status: z.enum(['suggested', 'saved', 'promising', 'needs-info', 'dismissed', 'in-review']), note: text(5000).optional(), dismissReason: text(500).optional(), updatedAt: iso.optional() })).max(1000),
  opportunityId: id.optional(),
  snapshot: z.array(z.object({ facultyId: id, score: z.number(), confidence: z.number(), rank: z.number() })).max(2000),
});

const outcomeKind = z.enum(['successful-collaboration', 'agreement-signed', 'productive-introduction', 'wrong-expertise', 'no-response', 'faculty-unavailable', 'budget-mismatch', 'duplicate-relationship', 'priorities-changed', 'other']);

export const opportunitySchema = z.object({
  id, title: text(300).min(1), companyId: id, interestId: id.optional(),
  type: z.enum(['sponsored-research', 'faculty-collaboration', 'recruiting', 'licensing', 'event-sponsorship', 'center-membership']),
  description: text(), stage, priority, ownerId: id, facultyIds: ids, matchSearchId: id.optional(), nextAction: text(1000).optional(), followUp: iso.optional(),
  estimatedValue: z.object({ amount: z.number().positive(), basis: text(1000).min(5) }).optional(),
  outcomes: z.array(z.object({ kind: outcomeKind, note: text(5000).optional(), recordedAt: iso, recordedBy: id, facultyId: id.optional() })).max(100),
  closeReason: text(2000).optional(), notes: z.array(note).max(1000), createdAt: iso, updatedAt: iso, stageEnteredAt: iso,
  stageHistory: z.array(z.object({ stage, at: iso, by: id })).max(500), signalIds: ids,
});

export const reviewSchema = z.object({
  id, kind: z.enum(['match', 'introduction', 'faculty-verification', 'company-info', 'low-confidence', 'data-conflict', 'incomplete-opportunity', 'ip-review']),
  title: text(500), summary: text(), reason: text(), status: z.enum(['pending', 'approved', 'rejected', 'changes-requested']), priority,
  createdAt: iso, createdBy: id, assigneeId: id.optional(), decidedAt: iso.optional(), decidedBy: id.optional(),
  facultyId: id.optional(), companyId: id.optional(), opportunityId: id.optional(), matchSearchId: id.optional(), dataIssueId: id.optional(), ipId: id.optional(),
  missing: z.array(text(1000)).max(50), checklist: z.array(z.object({ key: text(50), label: text(500), hint: text(500).optional(), checked: z.boolean() })).max(30),
  history: z.array(z.object({ at: iso, by: id, action: z.enum(['created', 'commented', 'approved', 'rejected', 'changes-requested', 'reopened', 'checked', 'assigned']), note: text(5000).optional() })).max(1000),
  scoreAtRequest: z.number().min(0).max(100).optional(),
});

export const draftSchema = z.object({
  id, opportunityId: id, facultyId: id, reviewId: id, subject: text(500), body: text(50_000), status: z.enum(['draft', 'recorded-sent']),
  createdAt: iso, createdBy: id, updatedAt: iso, recordedAt: iso.optional(), recordedBy: id.optional(), recordedChannel: text(300).optional(),
});

export const activitySchema = z.object({
  id, at: iso, actorId: id,
  kind: z.enum(['stage-change', 'note', 'review', 'intro-draft', 'intro-recorded', 'meeting', 'call', 'email-logged', 'match', 'created', 'outcome', 'signal', 'data', 'task']),
  text: text(5000), companyId: id.optional(), opportunityId: id.optional(), facultyId: id.optional(), reviewId: id.optional(),
});

export const taskSchema = z.object({ id, title: text(500).min(1), due: iso, ownerId: id, done: z.boolean(), doneAt: iso.optional(), companyId: id.optional(), opportunityId: id.optional(), createdAt: iso });

export const signalSchema = z.object({
  id, kind: z.enum(['new-project', 'new-publication', 'new-ip', 'company-announcement', 'company-focus-change', 'funding-announcement', 'new-interest', 'record-updated']),
  title: text(500).min(1), detail: text(), date: iso, source: sourceRef, facultyIds: ids, companyIds: ids, topics: z.array(z.string()).max(30),
  suggestedAction: text(2000), status: z.enum(['new', 'reviewed', 'converted', 'dismissed']), opportunityId: id.optional(), ingestedBy: text(100),
});

export const sourceSchema = z.object({
  id, name: text(200), kind: z.enum(['api', 'faculty-directory', 'publication-db', 'university-records', 'ott', 'import', 'manual', 'company-site', 'news']),
  provider: text(100), status: z.enum(['demo', 'not-connected', 'manual', 'awaiting-access', 'connected', 'error']),
  description: text(2000), owner: text(200), lastSync: iso.optional(), cadence: text(100).optional(), recordTypes: z.array(text(100)).max(20), accessNote: text(2000),
  lastResult: z.object({ at: iso, created: z.number(), updated: z.number(), conflicts: z.number(), errors: z.number(), message: text(2000).optional() }).optional(),
});

export const issueSchema = z.object({
  id, kind: z.enum(['stale', 'missing', 'conflict', 'duplicate', 'unverified-contact']), entity: z.enum(['faculty', 'company', 'project', 'publication', 'ip']), entityId: id,
  field: text(100).optional(), detail: text(5000), values: z.array(z.object({ value: text(5000), sourceId: id })).max(20).optional(), duplicateOfId: id.optional(),
  status: z.enum(['open', 'resolved', 'ignored']), resolution: text(2000).optional(), resolvedBy: id.optional(), resolvedAt: iso.optional(), createdAt: iso,
});

export const importSchema = z.object({ id, at: iso, by: id, fileName: text(300), entity: text(50), created: z.number(), skipped: z.number(), duplicates: z.number(), sourceId: id });
export const feedbackSchema = z.object({ id, at: iso, authorId: id, stakeholder: text(100).optional(), page: text(500), kind: z.enum(['match-quality', 'missing-data', 'workflow', 'idea', 'other']), text: text(10_000).min(1), status: z.enum(['open', 'triaged', 'closed']) });
export const shortlistSchema = z.object({ id, name: text(200).min(1), description: text(2000).optional(), facultyIds: ids, createdAt: iso, createdBy: id });
export const notificationSchema = z.object({ id, at: iso, userId: id, kind: z.enum(['review', 'follow-up', 'data', 'signal', 'mention']), text: text(1000), href: text(1000), read: z.boolean() });

export const SCHEMAS: Record<CollectionName, z.ZodType> = {
  users: userSchema, departments: departmentSchema, faculty: facultySchema, companies: companySchema, interests: interestSchema,
  relationships: relationshipSchema, projects: projectSchema, publications: publicationSchema, ip: ipSchema, searches: searchSchema,
  opportunities: opportunitySchema, reviews: reviewSchema, drafts: draftSchema, activities: activitySchema, tasks: taskSchema,
  signals: signalSchema, sources: sourceSchema, issues: issueSchema, imports: importSchema, feedback: feedbackSchema,
  shortlists: shortlistSchema, notifications: notificationSchema,
};

/** Validate a record. Returns the cleaned record or a human-readable error. */
export function validateRecord(collection: CollectionName, record: unknown): { ok: true; value: { id: string } & Record<string, unknown> } | { ok: false; error: string } {
  const r = SCHEMAS[collection].safeParse(record);
  if (r.success) return { ok: true, value: r.data as { id: string } & Record<string, unknown> };
  const first = r.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(record)'}: ${i.message}`).join('; ');
  return { ok: false, error: `Invalid ${collection} record: ${first}` };
}
