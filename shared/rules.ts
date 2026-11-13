/**
 * Workflow rules shared by the client (for instant feedback) and the server
 * (for enforcement). Keeping them in one pure module makes them testable.
 */
import type {
  Database, IntroDraft, Opportunity, OpportunityType, ReviewItem, ReviewKind, ReviewStatus, Stage,
} from './types';

export const STAGES: { id: Stage; label: string; short: string; description: string }[] = [
  { id: 'new', label: 'New opportunity', short: 'New', description: 'Logged, not yet scoped.' },
  { id: 'discovery', label: 'Needs discovery', short: 'Discovery', description: 'Clarifying what the company actually needs.' },
  { id: 'matching', label: 'Matching', short: 'Matching', description: 'Identifying faculty, programs or technologies.' },
  { id: 'review', label: 'Internal review', short: 'Review', description: 'A human is checking the recommendation and evidence.' },
  { id: 'intro-prepared', label: 'Introduction prepared', short: 'Intro prepared', description: 'A draft exists. Nothing has been sent.' },
  { id: 'intro-recorded', label: 'Introduction recorded', short: 'Intro recorded', description: 'Staff manually recorded that an introduction happened outside this system.' },
  { id: 'discussion', label: 'Discussion underway', short: 'Discussion', description: 'The parties are talking.' },
  { id: 'outcome', label: 'Agreement / outcome', short: 'Outcome', description: 'An outcome has been recorded.' },
  { id: 'closed', label: 'Closed or archived', short: 'Closed', description: 'No further action.' },
];

export const STAGE_INDEX: Record<Stage, number> = Object.fromEntries(STAGES.map((s, i) => [s.id, i])) as Record<Stage, number>;
export const stageLabel = (s: Stage) => STAGES[STAGE_INDEX[s]].label;

export const OPPORTUNITY_TYPES: { id: OpportunityType; label: string; pathway: 'research' | 'talent' | 'engagement'; stages: Stage[]; description: string }[] = [
  {
    id: 'sponsored-research', label: 'Sponsored research', pathway: 'research',
    stages: ['new', 'discovery', 'matching', 'review', 'intro-prepared', 'intro-recorded', 'discussion', 'outcome', 'closed'],
    description: 'Company funds a defined research project with faculty.',
  },
  {
    id: 'faculty-collaboration', label: 'Faculty collaboration', pathway: 'research',
    stages: ['new', 'discovery', 'matching', 'review', 'intro-prepared', 'intro-recorded', 'discussion', 'outcome', 'closed'],
    description: 'Exploratory or informal collaboration with a researcher.',
  },
  {
    id: 'licensing', label: 'Technology licensing', pathway: 'research',
    stages: ['new', 'discovery', 'matching', 'review', 'intro-prepared', 'intro-recorded', 'discussion', 'outcome', 'closed'],
    description: 'Interest in university IP. Coordinated with the Office of Technology Transfer.',
  },
  {
    id: 'recruiting', label: 'Recruiting partnership', pathway: 'talent',
    stages: ['new', 'discovery', 'matching', 'review', 'discussion', 'outcome', 'closed'],
    description: 'Access to students, programs and research groups for hiring.',
  },
  {
    id: 'event-sponsorship', label: 'Event / brand engagement', pathway: 'engagement',
    stages: ['new', 'discovery', 'review', 'discussion', 'outcome', 'closed'],
    description: 'Sponsored events, seminars, visibility on campus.',
  },
  {
    id: 'center-membership', label: 'Research center engagement', pathway: 'engagement',
    stages: ['new', 'discovery', 'matching', 'review', 'discussion', 'outcome', 'closed'],
    description: 'Membership or affiliation with a research center or consortium.',
  },
];

export const TYPE_BY_ID = Object.fromEntries(OPPORTUNITY_TYPES.map((t) => [t.id, t])) as Record<OpportunityType, (typeof OPPORTUNITY_TYPES)[number]>;

/** Review kinds that gate an outreach decision. These can never be bulk-approved. */
export const OUTREACH_REVIEW_KINDS: ReviewKind[] = ['match', 'introduction', 'low-confidence'];

export type Guard = { ok: true; confirm?: string } | { ok: false; reason: string; fix?: 'create-review' | 'record-outcome' | 'add-close-reason' | 'create-draft' };

export function approvedIntroReviews(db: Pick<Database, 'reviews'>, oppId: string): ReviewItem[] {
  return Object.values(db.reviews).filter(
    (r) => r.opportunityId === oppId && (r.kind === 'introduction' || r.kind === 'match') && r.status === 'approved',
  );
}

/**
 * Can `opp` move to `to`? Returns a reason when blocked, or an optional
 * confirmation message for consequential (but allowed) transitions.
 */
export function canTransition(
  opp: Opportunity,
  to: Stage,
  db: Pick<Database, 'reviews' | 'drafts'>,
  extra: { outcomeProvided?: boolean; closeReason?: string } = {},
): Guard {
  if (opp.stage === to) return { ok: false, reason: 'Already in this stage.' };
  const type = TYPE_BY_ID[opp.type];
  if (!type.stages.includes(to)) {
    return { ok: false, reason: `${type.label} opportunities don't use the “${stageLabel(to)}” stage.` };
  }
  const forward = STAGE_INDEX[to] > STAGE_INDEX[opp.stage];

  if (to === 'intro-prepared') {
    if (!approvedIntroReviews(db, opp.id).length) {
      return { ok: false, reason: 'An introduction can only be prepared after a reviewer approves the match.', fix: 'create-review' };
    }
    return { ok: true, confirm: 'Moving to “Introduction prepared” does not send anything. You will draft and copy the introduction yourself.' };
  }

  if (to === 'intro-recorded') {
    if (!approvedIntroReviews(db, opp.id).length) {
      return { ok: false, reason: 'No approved review exists for this opportunity.', fix: 'create-review' };
    }
    const sent = Object.values(db.drafts).some((d) => d.opportunityId === opp.id && d.status === 'recorded-sent');
    if (!sent) {
      return { ok: false, reason: 'Record the introduction as sent from its draft first. This system never sends messages; this only records what you did.', fix: 'create-draft' };
    }
  }

  if (to === 'outcome' && forward && !extra.outcomeProvided && opp.outcomes.length === 0) {
    return { ok: false, reason: 'Record what happened before moving to Outcome.', fix: 'record-outcome' };
  }

  if (to === 'closed' && !extra.closeReason && !opp.closeReason) {
    return { ok: false, reason: 'Closing requires a reason.', fix: 'add-close-reason' };
  }

  if (to === 'review' && forward && opp.facultyIds.length === 0 && (type.pathway === 'research')) {
    return { ok: true, confirm: 'No faculty are linked yet. Reviewers will only be able to assess the company need.' };
  }

  if (!forward) return { ok: true, confirm: `Move back to “${stageLabel(to)}”? Stage history keeps the earlier entry.` };
  return { ok: true };
}

/* --------------------------------------------------------------------------
 * Review decisions
 * ------------------------------------------------------------------------ */

export function canDecide(item: ReviewItem, decision: Exclude<ReviewStatus, 'pending'>, opts: { reviewerCanReview: boolean; comment?: string; bulk?: boolean }): Guard {
  if (!opts.reviewerCanReview) return { ok: false, reason: 'Your role cannot make review decisions.' };
  if (item.status !== 'pending' && item.status !== 'changes-requested') return { ok: false, reason: `Already ${item.status.replace('-', ' ')}. Reopen it to decide again.` };
  if (decision === 'approved') {
    if (opts.bulk && OUTREACH_REVIEW_KINDS.includes(item.kind)) {
      return { ok: false, reason: 'Outreach-related reviews must be approved one at a time with their evidence in view.' };
    }
    const open = item.checklist.filter((c) => !c.checked);
    if (open.length) return { ok: false, reason: `Complete the checklist first (${open.length} item${open.length > 1 ? 's' : ''} open).` };
  }
  if ((decision === 'rejected' || decision === 'changes-requested') && !opts.comment?.trim()) {
    return { ok: false, reason: 'Add a short comment explaining the decision.' };
  }
  return { ok: true };
}

/** Standard checklist for a match / introduction review. */
export function introChecklist(): ReviewItem['checklist'] {
  return [
    { key: 'why', label: 'The reason for the recommendation makes sense', hint: 'Read the match explanation and evidence.', checked: false },
    { key: 'current', label: 'Supporting evidence is current', hint: 'Check project dates and last-verified date.', checked: false },
    { key: 'contact', label: 'Contact details are verified, or a warm path is identified', checked: false },
    { key: 'fit', label: 'The intended engagement type makes sense for this researcher', checked: false },
    { key: 'process', label: 'Relevant administrative steps are understood (e.g. OTT for IP)', checked: false },
    { key: 'gaps', label: 'Open questions are noted for the introduction', checked: false },
  ];
}

/* --------------------------------------------------------------------------
 * Introduction drafts
 * ------------------------------------------------------------------------ */

export function canCreateDraft(db: Pick<Database, 'reviews'>, oppId: string, facultyId: string): Guard {
  const ok = approvedIntroReviews(db, oppId).some((r) => !r.facultyId || r.facultyId === facultyId);
  return ok ? { ok: true } : { ok: false, reason: 'A reviewer must approve this match before an introduction can be drafted.', fix: 'create-review' };
}

export function canRecordSent(draft: IntroDraft, channel?: string): Guard {
  if (draft.status === 'recorded-sent') return { ok: false, reason: 'Already recorded as sent.' };
  if (!draft.body.trim() || !draft.subject.trim()) return { ok: false, reason: 'The draft is empty.' };
  if (!channel?.trim()) return { ok: false, reason: 'Say how it was sent (e.g. “Email from my Outlook”).' };
  return { ok: true, confirm: 'This records that you sent the introduction yourself. This system has not sent anything.' };
}

/* --------------------------------------------------------------------------
 * Freshness
 * ------------------------------------------------------------------------ */

export function freshness(lastVerified: string | undefined, now = new Date()): 'fresh' | 'aging' | 'stale' | 'unknown' {
  if (!lastVerified) return 'unknown';
  const days = (now.getTime() - Date.parse(lastVerified)) / 86_400_000;
  if (days <= 180) return 'fresh';
  if (days <= 365) return 'aging';
  return 'stale';
}

export const OUTCOME_LABELS: Record<string, { label: string; success: boolean | null }> = {
  'successful-collaboration': { label: 'Successful collaboration', success: true },
  'agreement-signed': { label: 'Agreement signed', success: true },
  'productive-introduction': { label: 'Productive introduction', success: true },
  'wrong-expertise': { label: 'Wrong expertise', success: false },
  'no-response': { label: 'No response', success: false },
  'faculty-unavailable': { label: 'Faculty unavailable', success: false },
  'budget-mismatch': { label: 'Budget mismatch', success: false },
  'duplicate-relationship': { label: 'Duplicate relationship', success: false },
  'priorities-changed': { label: 'Company priorities changed', success: false },
  other: { label: 'Other', success: null },
};
