/**
 * Domain operations. Each one builds a list of record changes (ops) plus an
 * activity entry and commits them atomically through the store. Rules come
 * from @shared/rules so the client and server agree.
 */
import { toast } from 'sonner';
import { canReview } from '@shared/roles';
import { canCreateDraft, canDecide, canRecordSent, canTransition, introChecklist, stageLabel, OUTREACH_REVIEW_KINDS } from '@shared/rules';
import { conceptLabel } from '@shared/taxonomy';
import type {
  Activity, Candidate, Company, CompanyInterest, DataIssue, Faculty, Feedback, ID, IntroDraft, IPRecord, MatchRequest,
  MatchSearch, Note, Op, Opportunity, OutcomeRecord, ReviewItem, ReviewStatus, Shortlist, Signal, Stage, Task,
} from '@shared/types';
import type { MatchResponse, MatchResult } from '@shared/matching/types';
import { nowIso, uid } from './format';
import { useStore } from './store';

const S = () => useStore.getState();
const db = () => S().db!;
const me = () => S().userId;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const put = <T extends { id: ID }>(collection: Op["collection"], record: T): Op => ({ op: 'put', collection, record: record as any });

function activity(kind: Activity['kind'], text: string, refs: Partial<Pick<Activity, 'companyId' | 'opportunityId' | 'facultyId' | 'reviewId'>> = {}): Op {
  return put('activities', { id: uid('a'), at: nowIso(), actorId: me(), kind, text, ...refs } as Activity);
}

/** Choose a reviewer for a new review item, preferring a team (e.g. OTT for IP). Never the current user if avoidable. */
function pickAssignee(team?: string): ID | undefined {
  const reviewers = Object.values(db().users).filter((u) => canReview(u) && u.id !== me());
  return (team ? reviewers.find((u) => u.team === team) : undefined)?.id ?? reviewers[0]?.id;
}

function notify(userId: ID | undefined, kind: 'review' | 'follow-up' | 'data' | 'signal' | 'mention', text: string, href: string): Op[] {
  if (!userId || userId === me()) return [];
  return [put('notifications', { id: uid('n'), at: nowIso(), userId, kind, text, href, read: false })];
}

/* ----------------------------------------------------------------------- */
/* Opportunities                                                           */
/* ----------------------------------------------------------------------- */

export type MoveExtra = { outcome?: Omit<OutcomeRecord, 'recordedAt' | 'recordedBy'>; closeReason?: string };

export function guardMove(opp: Opportunity, to: Stage, extra: MoveExtra = {}) {
  return canTransition(opp, to, db(), { outcomeProvided: !!extra.outcome, closeReason: extra.closeReason });
}

export async function moveOpportunity(oppId: ID, to: Stage, extra: MoveExtra = {}) {
  const opp = db().opportunities[oppId];
  const g = guardMove(opp, to, extra);
  if (!g.ok) { toast.error(g.reason); return false; }
  const at = nowIso();
  const outcomes = extra.outcome ? [...opp.outcomes, { ...extra.outcome, recordedAt: at, recordedBy: me() }] : opp.outcomes;
  const next: Opportunity = {
    ...opp, stage: to, updatedAt: at, stageEnteredAt: at, outcomes,
    closeReason: extra.closeReason ?? opp.closeReason,
    stageHistory: [...opp.stageHistory, { stage: to, at, by: me() }],
  };
  const ops = [put('opportunities', next), activity('stage-change', `Moved to ${stageLabel(to)}`, { opportunityId: oppId, companyId: opp.companyId })];
  if (extra.outcome) ops.push(activity('outcome', `Outcome recorded: ${extra.outcome.kind.replace(/-/g, ' ')}`, { opportunityId: oppId, companyId: opp.companyId, facultyId: extra.outcome.facultyId }));
  return S().commit(ops, { success: `Moved to ${stageLabel(to)}` });
}

export async function updateOpportunity(oppId: ID, patch: Partial<Opportunity>, note?: string) {
  const opp = db().opportunities[oppId];
  const ops = [put('opportunities', { ...opp, ...patch, updatedAt: nowIso() })];
  if (note) ops.push(activity('note', note, { opportunityId: oppId, companyId: opp.companyId }));
  return S().commit(ops, { success: 'Saved' });
}

export async function createOpportunity(input: Pick<Opportunity, 'title' | 'companyId' | 'type' | 'description' | 'priority' | 'ownerId' | 'facultyIds'> & Partial<Opportunity>, opts: { requestReviewFor?: ID[]; reviewContext?: Record<ID, MatchResult> } = {}) {
  const at = nowIso();
  const stage: Stage = input.stage ?? (input.facultyIds.length ? 'matching' : 'new');
  const opp: Opportunity = {
    id: uid('o'), outcomes: [], notes: [], signalIds: [], createdAt: at, updatedAt: at, stageEnteredAt: at,
    stageHistory: [{ stage, at, by: me() }], ...input, stage,
  };
  const ops: Op[] = [put('opportunities', opp), activity('created', `Created opportunity: ${opp.title}`, { opportunityId: opp.id, companyId: opp.companyId })];
  if (input.matchSearchId) {
    const s = db().searches[input.matchSearchId];
    if (s) ops.push(put('searches', { ...s, opportunityId: opp.id }));
  }
  if (opts.requestReviewFor?.length) {
    const reviewOps = buildMatchReviews(opp, opts.requestReviewFor, opts.reviewContext ?? {});
    ops.push(...reviewOps);
    const at2 = nowIso();
    const reviewed: Opportunity = { ...opp, stage: 'review', stageEnteredAt: at2, stageHistory: [...opp.stageHistory, { stage: 'review', at: at2, by: me() }] };
    ops[0] = put('opportunities', reviewed);
    ops.push(activity('stage-change', 'Moved to Internal review', { opportunityId: opp.id, companyId: opp.companyId }));
  }
  const ok = await S().commit(ops, { success: opts.requestReviewFor?.length ? `Opportunity created · ${opts.requestReviewFor.length} sent to review` : 'Opportunity created' });
  return ok ? opp.id : null;
}

function buildMatchReviews(opp: Opportunity, facultyIds: ID[], ctx: Record<ID, MatchResult>): Op[] {
  const ops: Op[] = [];
  const assignee = pickAssignee('CEC');
  for (const fid of facultyIds) {
    const f = db().faculty[fid];
    const r = ctx[fid];
    const lowConf = r?.confidence.level === 'low';
    const item: ReviewItem = {
      id: uid('r'), kind: lowConf ? 'low-confidence' : 'match', status: 'pending', priority: opp.priority,
      title: `${f.name} for ${db().companies[opp.companyId]?.name ?? 'company'} — ${opp.title}`,
      summary: r ? `${r.summary} Score ${r.score}/100, ${r.confidence.level} evidence confidence.` : `Proposed researcher for ${opp.title}.`,
      reason: lowConf
        ? 'Low evidence confidence: a person should confirm the researcher is current and relevant before any introduction.'
        : 'Every proposed introduction needs a human check of evidence, contact details and process.',
      createdAt: nowIso(), createdBy: me(), assigneeId: assignee, facultyId: fid, companyId: opp.companyId, opportunityId: opp.id,
      matchSearchId: opp.matchSearchId,
      missing: r ? r.unknowns.slice(0, 4) : [],
      checklist: introChecklist(),
      history: [{ at: nowIso(), by: me(), action: 'created' }],
    };
    ops.push(put('reviews', item), activity('review', `Requested review: ${f.name}`, { opportunityId: opp.id, companyId: opp.companyId, facultyId: fid, reviewId: item.id }));
    ops.push(...notify(assignee, 'review', `${S().db!.users[me()].name} requested your review: ${f.name}`, `/review?item=${item.id}`));
  }
  return ops;
}

export async function requestReview(oppId: ID, facultyIds: ID[], ctx: Record<ID, MatchResult> = {}) {
  const opp = db().opportunities[oppId];
  const ops = buildMatchReviews(opp, facultyIds, ctx);
  const newFaculty = [...new Set([...opp.facultyIds, ...facultyIds])];
  let next: Opportunity = { ...opp, facultyIds: newFaculty, updatedAt: nowIso() };
  if (['new', 'discovery', 'matching'].includes(opp.stage)) {
    const at = nowIso();
    next = { ...next, stage: 'review', stageEnteredAt: at, stageHistory: [...opp.stageHistory, { stage: 'review', at, by: me() }] };
    ops.push(activity('stage-change', 'Moved to Internal review', { opportunityId: oppId, companyId: opp.companyId }));
  }
  ops.unshift(put('opportunities', next));
  return S().commit(ops, { success: `Sent ${facultyIds.length} to review` });
}

export async function addOpportunityNote(oppId: ID, text: string) {
  const opp = db().opportunities[oppId];
  const note: Note = { id: uid('note'), authorId: me(), at: nowIso(), text };
  return S().commit([put('opportunities', { ...opp, notes: [note, ...opp.notes], updatedAt: nowIso() }), activity('note', text, { opportunityId: oppId, companyId: opp.companyId })], { success: 'Note added' });
}

export async function logActivity(kind: Activity['kind'], text: string, refs: Partial<Pick<Activity, 'companyId' | 'opportunityId' | 'facultyId'>>) {
  return S().commit([activity(kind, text, refs)], { success: 'Activity logged' });
}

export async function recordOutcome(oppId: ID, outcome: Omit<OutcomeRecord, 'recordedAt' | 'recordedBy'>) {
  const opp = db().opportunities[oppId];
  const rec = { ...outcome, recordedAt: nowIso(), recordedBy: me() };
  return S().commit([
    put('opportunities', { ...opp, outcomes: [...opp.outcomes, rec], updatedAt: nowIso() }),
    activity('outcome', `Outcome recorded: ${outcome.kind.replace(/-/g, ' ')}`, { opportunityId: oppId, companyId: opp.companyId, facultyId: outcome.facultyId }),
  ], { success: 'Outcome recorded' });
}

/* ----------------------------------------------------------------------- */
/* Tasks                                                                   */
/* ----------------------------------------------------------------------- */

export async function addTask(t: Pick<Task, 'title' | 'due'> & Partial<Task>) {
  const task: Task = { id: uid('t'), ownerId: me(), done: false, createdAt: nowIso(), ...t };
  return S().commit([put('tasks', task), activity('task', `Follow-up scheduled: ${task.title}`, { companyId: task.companyId, opportunityId: task.opportunityId })], { success: 'Follow-up scheduled' });
}

export async function toggleTask(id: ID) {
  const t = db().tasks[id];
  const done = !t.done;
  return S().commit([put('tasks', { ...t, done, doneAt: done ? nowIso() : undefined })], { success: done ? 'Marked done' : 'Reopened' });
}

/* ----------------------------------------------------------------------- */
/* Reviews                                                                 */
/* ----------------------------------------------------------------------- */

export async function toggleCheck(reviewId: ID, key: string) {
  const r = db().reviews[reviewId];
  const checklist = r.checklist.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c));
  return S().commit([put('reviews', { ...r, checklist })], { silent: true });
}

export async function commentReview(reviewId: ID, note: string) {
  const r = db().reviews[reviewId];
  return S().commit([put('reviews', { ...r, history: [...r.history, { at: nowIso(), by: me(), action: 'commented', note }] })], { success: 'Comment added' });
}

export async function assignReview(reviewIds: ID[], assigneeId: ID) {
  const ops: Op[] = [];
  for (const id of reviewIds) {
    const r = db().reviews[id];
    ops.push(put('reviews', { ...r, assigneeId, history: [...r.history, { at: nowIso(), by: me(), action: 'assigned', note: db().users[assigneeId].name }] }));
    ops.push(...notify(assigneeId, 'review', `Review assigned to you: ${r.title}`, `/review?item=${id}`));
  }
  return S().commit(ops, { success: `Assigned ${reviewIds.length}` });
}

export function guardDecision(r: ReviewItem, decision: Exclude<ReviewStatus, 'pending'>, comment?: string, bulk = false) {
  const user = db().users[me()];
  return canDecide(r, decision, { reviewerCanReview: canReview(user), comment, bulk });
}

const DECISION_LABEL = { approved: 'Approved', rejected: 'Rejected', 'changes-requested': 'Requested changes' } as const;

function decisionOps(r: ReviewItem, decision: Exclude<ReviewStatus, 'pending'>, comment?: string): Op[] {
  const at = nowIso();
  const next: ReviewItem = {
    ...r, status: decision, decidedAt: at, decidedBy: me(),
    history: [...r.history, { at, by: me(), action: decision, note: comment?.trim() || undefined }],
  };
  const ops: Op[] = [put('reviews', next), activity('review', `${DECISION_LABEL[decision]}: ${r.title}`, { reviewId: r.id, opportunityId: r.opportunityId, companyId: r.companyId, facultyId: r.facultyId })];
  if (decision === 'approved' && r.kind === 'faculty-verification' && r.facultyId) {
    const f = db().faculty[r.facultyId];
    ops.push(put('faculty', { ...f, lastVerified: at }));
  }
  if (decision === 'approved' && r.dataIssueId) {
    const i = db().issues[r.dataIssueId];
    if (i) ops.push(put('issues', { ...i, status: 'resolved', resolution: comment || 'Resolved in review', resolvedBy: me(), resolvedAt: at }));
  }
  if (decision === 'approved' && r.kind === 'ip-review' && r.ipId) {
    const ip = db().ip[r.ipId];
    if (ip) ops.push(put('ip', { ...ip, flaggedForReview: false }));
  }
  ops.push(...notify(r.createdBy, 'review', `${DECISION_LABEL[decision]}: ${r.title}`, `/review?item=${r.id}`));
  return ops;
}

export async function decideReview(reviewId: ID, decision: Exclude<ReviewStatus, 'pending'>, comment?: string) {
  const r = db().reviews[reviewId];
  const g = guardDecision(r, decision, comment);
  if (!g.ok) { toast.error(g.reason); return false; }
  return S().commit(decisionOps(r, decision, comment), { success: `${DECISION_LABEL[decision]}` });
}

export async function bulkApprove(ids: ID[]) {
  const ops: Op[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const r = db().reviews[id];
    const g = guardDecision(r, 'approved', undefined, true);
    if (g.ok) ops.push(...decisionOps(r, 'approved'));
    else skipped.push(r.title);
  }
  if (!ops.length) { toast.error('None of the selected items can be bulk-approved. Outreach decisions and incomplete checklists need individual review.'); return false; }
  const ok = await S().commit(ops, { success: `Approved ${ids.length - skipped.length}` });
  if (skipped.length) toast.message(`${skipped.length} skipped`, { description: 'Outreach decisions and incomplete checklists must be reviewed one at a time.' });
  return ok;
}

export async function reopenReview(reviewId: ID) {
  const r = db().reviews[reviewId];
  return S().commit([put('reviews', { ...r, status: 'pending', decidedAt: undefined, decidedBy: undefined, history: [...r.history, { at: nowIso(), by: me(), action: 'reopened' }] })], { success: 'Reopened' });
}

export const isOutreachKind = (k: ReviewItem['kind']) => OUTREACH_REVIEW_KINDS.includes(k);

/* ----------------------------------------------------------------------- */
/* Introduction drafts                                                     */
/* ----------------------------------------------------------------------- */

export function draftTemplate(opp: Opportunity, f: Faculty, result?: MatchResult) {
  const d = db();
  const company = d.companies[opp.companyId];
  const user = d.users[me()];
  const interest = opp.interestId ? d.interests[opp.interestId] : undefined;
  const topics = (result?.concepts.filter((c) => c.strength >= 0.5).map((c) => conceptLabel(c.concept)) ?? interest?.topics.map(conceptLabel) ?? []).slice(0, 3);
  const evidence = result?.evidence.filter((e) => e.type === 'project' || e.type === 'publication').slice(0, 2).map((e) => `“${e.title}”`) ?? [];
  const unknowns = result?.unknowns.filter((u) => !/Contact/.test(u)).slice(0, 2) ?? ['their timeline and budget'];
  const last = f.name.split(' ').slice(-1)[0];
  return {
    subject: `Introduction: ${company.name} × Prof. ${last} — ${opp.title}`,
    body: `Dear Professor ${last},

I'm writing from the Corporate Engagement Center to introduce ${company.name} (${company.industry.toLowerCase()}). ${company.description}

What they're exploring: ${(interest?.title ?? opp.title).replace(/\.$/, '')}.

Why we thought of you: ${topics.length ? `your work on ${topics.join(', ')}` : 'your research area'}${evidence.length ? `, including ${evidence.join(' and ')}` : ''}.

What we don't know yet: ${unknowns.map((u) => u.charAt(0).toLowerCase() + u.slice(1)).join('; ')}.

Would you be open to a short exploratory conversation? There is no commitment, and I'm happy to share more context first.

Best regards,
${user.name}
${user.title}`,
  };
}

export async function createDraft(oppId: ID, facultyId: ID, result?: MatchResult) {
  const g = canCreateDraft(db(), oppId, facultyId);
  if (!g.ok) { toast.error(g.reason); return null; }
  const opp = db().opportunities[oppId];
  const f = db().faculty[facultyId];
  const review = Object.values(db().reviews).find((r) => r.opportunityId === oppId && r.status === 'approved' && (!r.facultyId || r.facultyId === facultyId))!;
  const t = draftTemplate(opp, f, result);
  const draft: IntroDraft = { id: uid('dr'), opportunityId: oppId, facultyId, reviewId: review.id, ...t, status: 'draft', createdAt: nowIso(), createdBy: me(), updatedAt: nowIso() };
  const ops: Op[] = [put('drafts', draft), activity('intro-draft', `Drafted introduction to ${f.name} (not sent)`, { opportunityId: oppId, companyId: opp.companyId, facultyId })];
  if (guardMove(opp, 'intro-prepared').ok && ['review', 'matching', 'discovery', 'new'].includes(opp.stage)) {
    const at = nowIso();
    ops.push(put('opportunities', { ...opp, stage: 'intro-prepared', stageEnteredAt: at, updatedAt: at, stageHistory: [...opp.stageHistory, { stage: 'intro-prepared', at, by: me() }] }));
    ops.push(activity('stage-change', 'Moved to Introduction prepared', { opportunityId: oppId, companyId: opp.companyId }));
  }
  const ok = await S().commit(ops, { success: 'Draft created — nothing has been sent' });
  return ok ? draft.id : null;
}

export async function saveDraft(id: ID, patch: Pick<IntroDraft, 'subject' | 'body'>) {
  const d = db().drafts[id];
  return S().commit([put('drafts', { ...d, ...patch, updatedAt: nowIso() })], { success: 'Draft saved' });
}

export async function recordSent(id: ID, channel: string) {
  const d = db().drafts[id];
  const g = canRecordSent(d, channel);
  if (!g.ok) { toast.error(g.reason); return false; }
  const at = nowIso();
  const draft: IntroDraft = { ...d, status: 'recorded-sent', recordedAt: at, recordedBy: me(), recordedChannel: channel, updatedAt: at };
  const opp = db().opportunities[d.opportunityId];
  const f = db().faculty[d.facultyId];
  const ops: Op[] = [put('drafts', draft), activity('intro-recorded', `Recorded: introduction to ${f.name} sent via ${channel} (outside this system)`, { opportunityId: opp.id, companyId: opp.companyId, facultyId: f.id })];
  if (opp.stage === 'intro-prepared') {
    ops.push(put('opportunities', { ...opp, stage: 'intro-recorded', stageEnteredAt: at, updatedAt: at, stageHistory: [...opp.stageHistory, { stage: 'intro-recorded', at, by: me() }] }));
    ops.push(activity('stage-change', 'Moved to Introduction recorded', { opportunityId: opp.id, companyId: opp.companyId }));
  }
  return S().commit(ops, { success: 'Recorded as sent by you' });
}

/* ----------------------------------------------------------------------- */
/* Matching                                                                */
/* ----------------------------------------------------------------------- */

export async function saveSearch(request: MatchRequest, response: MatchResponse, title: string, opportunityId?: ID) {
  const search: MatchSearch = {
    id: uid('ms'), title, request, opportunityId, providerId: response.providerId, createdAt: nowIso(), createdBy: me(),
    candidates: [], snapshot: response.results.map((r) => ({ facultyId: r.facultyId, score: r.score, confidence: r.confidence.score, rank: r.rank })),
  };
  const company = request.companyId ? db().companies[request.companyId] : undefined;
  await S().commit([put('searches', search), activity('match', `Ran match: ${title} (${response.results.length} researchers)`, { companyId: company?.id })], { silent: true });
  return search.id;
}

export async function setCandidate(searchId: ID, facultyId: ID, patch: Partial<Candidate>, message?: string) {
  const s = db().searches[searchId];
  if (!s) return false;
  const existing = s.candidates.find((c) => c.facultyId === facultyId) ?? { facultyId, status: 'suggested' as const };
  const nextC = { ...existing, ...patch, updatedAt: nowIso() };
  const candidates = [...s.candidates.filter((c) => c.facultyId !== facultyId), nextC];
  return S().commit([put('searches', { ...s, candidates })], { success: message });
}

export async function deleteSearch(id: ID) {
  return S().commit([{ op: 'delete', collection: 'searches', id }], { success: 'Search removed' });
}

/* ----------------------------------------------------------------------- */
/* Faculty, shortlists                                                     */
/* ----------------------------------------------------------------------- */

export async function toggleSavedFaculty(id: ID) {
  const f = db().faculty[id];
  return S().commit([put('faculty', { ...f, saved: !f.saved })], { success: f.saved ? 'Removed from saved' : 'Saved' });
}

export async function upsertShortlist(list: Partial<Shortlist> & { name: string }) {
  const existing = list.id ? db().shortlists[list.id] : undefined;
  const next: Shortlist = existing ? { ...existing, ...list } as Shortlist : { id: uid('sl'), facultyIds: [], createdAt: nowIso(), createdBy: me(), ...list };
  await S().commit([put('shortlists', next)], { success: existing ? 'Collection updated' : 'Collection created' });
  return next.id;
}

export async function addToShortlist(listId: ID, facultyIds: ID[]) {
  const l = db().shortlists[listId];
  return S().commit([put('shortlists', { ...l, facultyIds: [...new Set([...l.facultyIds, ...facultyIds])] })], { success: `Added to ${l.name}` });
}

export async function removeFromShortlist(listId: ID, facultyId: ID) {
  const l = db().shortlists[listId];
  return S().commit([put('shortlists', { ...l, facultyIds: l.facultyIds.filter((x) => x !== facultyId) })], { success: 'Removed' });
}

export async function requestFacultyVerification(facultyId: ID, reason: string) {
  const f = db().faculty[facultyId];
  const item: ReviewItem = {
    id: uid('r'), kind: 'faculty-verification', status: 'pending', priority: 'medium', title: `Verify ${f.name} profile`,
    summary: reason, reason: 'Matching relies on current faculty information.', createdAt: nowIso(), createdBy: me(), assigneeId: pickAssignee('Research Office'), facultyId,
    missing: [], checklist: [{ key: 'c0', label: 'Title and department confirmed', checked: false }, { key: 'c1', label: 'Current projects listed', checked: false }, { key: 'c2', label: 'Contact verified', checked: false }],
    history: [{ at: nowIso(), by: me(), action: 'created', note: reason }],
  };
  return S().commit([put('reviews', item), activity('data', `Requested verification of ${f.name}`, { facultyId }), ...notify(item.assigneeId, 'data', `Verification requested: ${f.name}`, `/review?item=${item.id}`)], { success: 'Verification requested' });
}

/* ----------------------------------------------------------------------- */
/* Companies                                                               */
/* ----------------------------------------------------------------------- */

export async function createCompany(c: Pick<Company, 'name' | 'industry' | 'description' | 'size'> & Partial<Company>) {
  const company: Company = {
    id: uid('c'), objectives: [], relationship: 'prospect', ownerId: me(), notes: [], createdAt: nowIso(), lastTouch: nowIso(),
    sources: [{ sourceId: 'src-manual', label: `Entered by ${db().users[me()].name}`, retrievedAt: nowIso() }], ...c,
  };
  const ok = await S().commit([put('companies', company), activity('created', `Added company: ${company.name}`, { companyId: company.id })], { success: 'Company added' });
  return ok ? company.id : null;
}

export async function updateCompany(id: ID, patch: Partial<Company>) {
  return S().commit([put('companies', { ...db().companies[id], ...patch })], { success: 'Saved' });
}

export async function addCompanyNote(id: ID, text: string) {
  const c = db().companies[id];
  const note: Note = { id: uid('note'), authorId: me(), at: nowIso(), text };
  return S().commit([put('companies', { ...c, notes: [note, ...c.notes], lastTouch: nowIso() }), activity('note', text, { companyId: id })], { success: 'Note added' });
}

export async function upsertInterest(i: Partial<CompanyInterest> & Pick<CompanyInterest, 'companyId' | 'title' | 'pathway'>) {
  const existing = i.id ? db().interests[i.id] : undefined;
  const next: CompanyInterest = existing ? { ...existing, ...i } as CompanyInterest : { id: uid('ci'), description: '', topics: [], status: 'open', createdAt: nowIso(), ...i };
  return S().commit([put('interests', next), ...(existing ? [] : [activity('note', `Added ${i.pathway} interest: ${i.title}`, { companyId: i.companyId })])], { success: existing ? 'Interest updated' : 'Interest added' });
}

/* ----------------------------------------------------------------------- */
/* Signals                                                                 */
/* ----------------------------------------------------------------------- */

export async function setSignalStatus(id: ID, status: Signal['status']) {
  const s = db().signals[id];
  return S().commit([put('signals', { ...s, status })], { success: status === 'dismissed' ? 'Signal dismissed' : 'Marked reviewed' });
}

export async function attachSignal(signalId: ID, oppId: ID) {
  const s = db().signals[signalId];
  const o = db().opportunities[oppId];
  return S().commit([
    put('signals', { ...s, status: 'converted', opportunityId: oppId }),
    put('opportunities', { ...o, signalIds: [...new Set([...o.signalIds, signalId])], updatedAt: nowIso() }),
    activity('signal', `Signal attached: ${s.title}`, { opportunityId: oppId, companyId: o.companyId }),
  ], { success: 'Signal attached to opportunity' });
}

export async function markSignalConverted(signalId: ID, oppId: ID) {
  const s = db().signals[signalId];
  const o = db().opportunities[oppId];
  return S().commit([
    put('signals', { ...s, status: 'converted', opportunityId: oppId }),
    put('opportunities', { ...o, signalIds: [...new Set([...o.signalIds, signalId])] }),
  ], { silent: true });
}

export async function ingestSignals(signals: Signal[]) {
  return S().commit(signals.map((s) => put('signals', s)), { success: `${signals.length} demo signal${signals.length === 1 ? '' : 's'} ingested` });
}

/* ----------------------------------------------------------------------- */
/* Data health                                                             */
/* ----------------------------------------------------------------------- */

const ISSUE_COLLECTION = { faculty: 'faculty', company: 'companies', project: 'projects', publication: 'publications', ip: 'ip' } as const;

/**
 * Resolve a data issue. For conflicts, `choice` writes the chosen value back to
 * the record and records which source it came from (provenance), so the next
 * sync from the losing source raises a conflict again instead of overwriting.
 */
export async function resolveIssue(id: ID, resolution: string, status: DataIssue['status'] = 'resolved', choice?: { value: string; sourceId: ID }) {
  const i = db().issues[id];
  const ops: Op[] = [put('issues', { ...i, status, resolution, resolvedBy: me(), resolvedAt: nowIso() })];
  if (choice && i.field && status === 'resolved') {
    const coll = ISSUE_COLLECTION[i.entity];
    const rec = (db()[coll] as unknown as Record<string, Record<string, unknown>>)[i.entityId];
    if (rec) {
      const cur = rec[i.field];
      const value = typeof cur === 'number' ? Number(choice.value) : typeof cur === 'boolean' ? choice.value === 'true' : Array.isArray(cur) ? choice.value.split(/,\s*/) : choice.value;
      const provenance = { ...((rec.provenance as Record<string, unknown>) ?? {}), [i.field]: { sourceId: choice.sourceId === 'src-manual' ? 'src-manual' : choice.sourceId, at: nowIso() } };
      ops.push(put(coll, { ...rec, [i.field]: value, provenance } as unknown as { id: ID }));
    }
  }
  ops.push(activity('data', `${status === 'ignored' ? 'Ignored' : 'Resolved'} data issue: ${i.detail}`, i.entity === 'faculty' ? { facultyId: i.entityId } : i.entity === 'company' ? { companyId: i.entityId } : {}));
  return S().commit(ops, { success: status === 'ignored' ? 'Issue ignored' : 'Issue resolved' });
}

export async function markVerified(facultyId: ID, fields: { email?: boolean } = {}) {
  const f = db().faculty[facultyId];
  const at = nowIso();
  const ops: Op[] = [put('faculty', { ...f, lastVerified: at, emailVerified: fields.email ? true : f.emailVerified })];
  for (const i of Object.values(db().issues)) {
    if (i.entity === 'faculty' && i.entityId === facultyId && i.status === 'open' && (i.kind === 'stale' || (fields.email && i.kind === 'unverified-contact'))) {
      ops.push(put('issues', { ...i, status: 'resolved', resolution: 'Verified by staff', resolvedBy: me(), resolvedAt: at }));
    }
  }
  ops.push(activity('data', `Marked ${f.name} as verified${fields.email ? ' (including contact)' : ''}`, { facultyId }));
  return S().commit(ops, { success: 'Marked verified' });
}

export async function commitImport(ops: Op[], summary: string) {
  return S().commit([...ops, activity('data', summary)], { success: summary });
}

/* ----------------------------------------------------------------------- */
/* IP                                                                      */
/* ----------------------------------------------------------------------- */

export async function flagIP(ipId: ID, reason: string) {
  const ip = db().ip[ipId];
  const item: ReviewItem = {
    id: uid('r'), kind: 'ip-review', status: 'pending', priority: 'medium', title: `OTT review: ${ip.title}`,
    summary: reason, reason: 'IP status and licensing availability must be confirmed by OTT before it is discussed with a company.',
    createdAt: nowIso(), createdBy: me(), assigneeId: pickAssignee('OTT'), ipId, facultyId: ip.facultyIds[0], missing: ip.verified ? [] : ['OTT confirmation of status'],
    checklist: [{ key: 'c0', label: 'Status confirmed with OTT records', checked: false }, { key: 'c1', label: 'Licensing availability confirmed', checked: false }, { key: 'c2', label: 'Disclosure restrictions understood', checked: false }],
    history: [{ at: nowIso(), by: me(), action: 'created', note: reason }],
  };
  return S().commit([put('ip', { ...ip, flaggedForReview: true }), put('reviews', item), ...notify(item.assigneeId, 'review', `IP flagged for review: ${ip.title}`, `/review?item=${item.id}`)], { success: 'Flagged for OTT review' });
}

export async function linkIPToInterest(ipId: ID, interestId: ID, on: boolean) {
  const ip: IPRecord = db().ip[ipId];
  const ids = on ? [...new Set([...ip.linkedInterestIds, interestId])] : ip.linkedInterestIds.filter((x) => x !== interestId);
  return S().commit([put('ip', { ...ip, linkedInterestIds: ids })], { success: on ? 'Linked to company interest' : 'Unlinked' });
}

/* ----------------------------------------------------------------------- */
/* Feedback & notifications                                                */
/* ----------------------------------------------------------------------- */

export async function submitFeedback(f: Pick<Feedback, 'kind' | 'text' | 'page'> & { stakeholder?: string }) {
  return S().commit([put('feedback', { id: uid('fb'), at: nowIso(), authorId: me(), status: 'open', ...f })], { success: 'Thanks — feedback saved' });
}

export async function setFeedbackStatus(id: ID, status: Feedback['status']) {
  return S().commit([put('feedback', { ...db().feedback[id], status })], { silent: true });
}

export async function markNotificationsRead(ids: ID[]) {
  const ops = ids.map((id) => put('notifications', { ...db().notifications[id], read: true }));
  return ops.length ? S().commit(ops, { silent: true }) : true;
}
