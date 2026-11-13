import { describe, expect, it } from 'vitest';
import { canCreateDraft, canDecide, canRecordSent, canTransition, introChecklist } from './rules';
import { buildSeed } from './seed';
import type { Opportunity, ReviewItem } from './types';

const db = buildSeed(new Date('2026-10-19T12:00:00Z'));
const opp = (id: string) => db.opportunities[id];

describe('opportunity transitions', () => {
  it('blocks preparing an introduction without an approved review', () => {
    const g = canTransition(opp('o-meridian-lnp'), 'intro-prepared', db);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.fix).toBe('create-review');
  });

  it('allows preparing an introduction after approval, with a no-send confirmation', () => {
    const o: Opportunity = { ...opp('o-corvane-edge'), stage: 'review' };
    const g = canTransition(o, 'intro-prepared', db);
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.confirm).toMatch(/does not send/);
  });

  it('requires a draft recorded as sent before "Introduction recorded"', () => {
    const g = canTransition(opp('o-corvane-edge'), 'intro-recorded', db);
    expect(g.ok).toBe(false);
    const recorded = { ...db, drafts: { ...db.drafts, 'dr-corvane': { ...db.drafts['dr-corvane'], status: 'recorded-sent' as const } } };
    expect(canTransition(opp('o-corvane-edge'), 'intro-recorded', recorded).ok).toBe(true);
  });

  it('does not force recruiting through an introduction workflow', () => {
    const g = canTransition(opp('o-corvane-gan'), 'intro-prepared', db);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toMatch(/don.t use/);
  });

  it('requires an outcome before moving to Outcome, and a reason to close', () => {
    expect(canTransition(opp('o-arbor-scout'), 'outcome', db).ok).toBe(false);
    expect(canTransition(opp('o-arbor-scout'), 'outcome', db, { outcomeProvided: true }).ok).toBe(true);
    expect(canTransition(opp('o-arbor-scout'), 'closed', db).ok).toBe(false);
    expect(canTransition(opp('o-arbor-scout'), 'closed', db, { closeReason: 'Company paused' }).ok).toBe(true);
  });

  it('asks for confirmation when moving backwards', () => {
    const g = canTransition(opp('o-arbor-scout'), 'matching', db);
    expect(g.ok && g.confirm).toBeTruthy();
  });
});

describe('review decisions', () => {
  const base: ReviewItem = { ...db.reviews['r-meridian-sato'] };

  it('cannot approve with an incomplete checklist', () => {
    const g = canDecide(base, 'approved', { reviewerCanReview: true });
    expect(g.ok).toBe(false);
  });

  it('can approve once every check is complete', () => {
    const done = { ...base, checklist: introChecklist().map((c) => ({ ...c, checked: true })) };
    expect(canDecide(done, 'approved', { reviewerCanReview: true }).ok).toBe(true);
  });

  it('never bulk-approves outreach decisions', () => {
    const done = { ...base, checklist: introChecklist().map((c) => ({ ...c, checked: true })) };
    const g = canDecide(done, 'approved', { reviewerCanReview: true, bulk: true });
    expect(g.ok).toBe(false);
  });

  it('allows bulk approval of data-only reviews', () => {
    const d = { ...db.reviews['r-novak-conflict'], checklist: db.reviews['r-novak-conflict'].checklist.map((c) => ({ ...c, checked: true })) };
    expect(canDecide(d, 'approved', { reviewerCanReview: true, bulk: true }).ok).toBe(true);
  });

  it('requires a comment to reject or request changes', () => {
    expect(canDecide(base, 'rejected', { reviewerCanReview: true }).ok).toBe(false);
    expect(canDecide(base, 'changes-requested', { reviewerCanReview: true, comment: 'Need budget' }).ok).toBe(true);
  });

  it('blocks viewers without review rights', () => {
    expect(canDecide(base, 'rejected', { reviewerCanReview: false, comment: 'x' }).ok).toBe(false);
  });
});

describe('introduction drafts', () => {
  it('cannot be drafted before approval', () => {
    expect(canCreateDraft(db, 'o-meridian-lnp', 'f-sato').ok).toBe(false);
    expect(canCreateDraft(db, 'o-corvane-edge', 'f-whitaker').ok).toBe(true);
  });

  it('recording as sent needs a channel and states that nothing was sent by the system', () => {
    const d = db.drafts['dr-corvane'];
    expect(canRecordSent(d).ok).toBe(false);
    const g = canRecordSent(d, 'Outlook');
    expect(g.ok && g.confirm).toMatch(/This system has not sent/);
  });
});
