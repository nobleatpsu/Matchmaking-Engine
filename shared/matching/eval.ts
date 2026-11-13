/**
 * Offline evaluation of a matcher against what people actually decided.
 *
 * Labels come from three places, strongest first:
 *   1. Outcomes on opportunities   success → positive, "wrong expertise" → negative
 *   2. Review decisions            approved → positive, rejected → negative
 *   3. Match Studio shortlists     saved/promising/in-review → positive,
 *                                  dismissed as "Wrong expertise" → negative
 *
 * Outcomes like "budget mismatch" or "no response" are NOT treated as
 * algorithm errors — the match may have been right.
 *
 * Metrics: hit@1/3/5, MRR, recall (positives found at all), and pairwise
 * accuracy (a positive ranked above a negative for the same query).
 */
import { OUTCOME_LABELS } from '../rules';
import type { Database, MatchRequest } from '../types';
import { requestForOpportunity } from './requests';
import type { MatchResponse } from './types';

export interface LabeledQuery {
  id: string;
  label: string;
  request: MatchRequest;
  positives: string[];
  negatives: string[];
  sources: string[];
}

export function buildLabels(db: Database): LabeledQuery[] {
  const q = new Map<string, LabeledQuery>();
  const get = (id: string, label: string, request: MatchRequest) => {
    if (!q.has(id)) q.set(id, { id, label, request, positives: [], negatives: [], sources: [] });
    return q.get(id)!;
  };
  const add = (x: LabeledQuery, fid: string, pos: boolean, src: string) => {
    const [mine, other] = pos ? [x.positives, x.negatives] : [x.negatives, x.positives];
    if (!mine.includes(fid) && !other.includes(fid)) { mine.push(fid); if (!x.sources.includes(src)) x.sources.push(src); }
  };

  for (const o of Object.values(db.opportunities)) {
    const req = requestForOpportunity(db, o);
    for (const out of o.outcomes) {
      if (!out.facultyId) continue;
      const meta = OUTCOME_LABELS[out.kind];
      if (meta?.success) add(get(`opp:${o.id}`, o.title, req), out.facultyId, true, 'outcome');
      else if (out.kind === 'wrong-expertise') add(get(`opp:${o.id}`, o.title, req), out.facultyId, false, 'outcome');
    }
    for (const r of Object.values(db.reviews)) {
      if (r.opportunityId !== o.id || !r.facultyId || !['match', 'introduction', 'low-confidence'].includes(r.kind)) continue;
      if (r.status === 'approved') add(get(`opp:${o.id}`, o.title, req), r.facultyId, true, 'review');
      if (r.status === 'rejected') add(get(`opp:${o.id}`, o.title, req), r.facultyId, false, 'review');
    }
  }
  for (const s of Object.values(db.searches)) {
    for (const c of s.candidates) {
      const key = s.opportunityId ? `opp:${s.opportunityId}` : `search:${s.id}`;
      const x = get(key, s.title, s.request);
      if (['saved', 'promising', 'in-review'].includes(c.status)) add(x, c.facultyId, true, 'shortlist');
      if (c.status === 'dismissed' && /wrong expertise/i.test(c.dismissReason ?? '')) add(x, c.facultyId, false, 'shortlist');
    }
  }
  return [...q.values()].filter((x) => x.positives.length + x.negatives.length > 0);
}

export interface EvalResult {
  providerId: string;
  queries: number;
  withPositives: number;
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  mrr: number;
  recall: number;
  pairwiseAccuracy: number | null;
  perQuery: { id: string; label: string; positiveRanks: (number | null)[]; negativeRanks: (number | null)[] }[];
}

export function evaluate(providerId: string, labels: LabeledQuery[], responses: Map<string, MatchResponse>): EvalResult {
  let withPos = 0, h1 = 0, h3 = 0, h5 = 0, mrr = 0, found = 0, totalPos = 0, pairs = 0, correct = 0;
  const perQuery: EvalResult['perQuery'] = [];
  for (const l of labels) {
    const res = responses.get(l.id);
    const rank = (fid: string) => res?.results.find((r) => r.facultyId === fid)?.rank ?? null;
    const pr = l.positives.map(rank);
    const nr = l.negatives.map(rank);
    perQuery.push({ id: l.id, label: l.label, positiveRanks: pr, negativeRanks: nr });
    if (l.positives.length) {
      withPos++;
      const best = Math.min(...pr.map((r) => r ?? Infinity));
      if (best <= 1) h1++;
      if (best <= 3) h3++;
      if (best <= 5) h5++;
      if (best !== Infinity) mrr += 1 / best;
      totalPos += pr.length;
      found += pr.filter((r) => r !== null).length;
    }
    for (const p of pr) for (const n of nr) {
      pairs++;
      if ((p ?? Infinity) < (n ?? Infinity)) correct++;
    }
  }
  const d = (x: number) => (withPos ? Math.round((x / withPos) * 1000) / 1000 : 0);
  return {
    providerId, queries: labels.length, withPositives: withPos,
    hitAt1: d(h1), hitAt3: d(h3), hitAt5: d(h5), mrr: d(mrr),
    recall: totalPos ? Math.round((found / totalPos) * 1000) / 1000 : 0,
    pairwiseAccuracy: pairs ? Math.round((correct / pairs) * 1000) / 1000 : null,
    perQuery,
  };
}
