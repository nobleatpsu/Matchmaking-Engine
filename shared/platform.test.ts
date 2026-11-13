import { describe, expect, it } from 'vitest';
import { validateRecord } from './schemas';
import { buildSeed } from './seed';
import { buildLiveSeed } from './seed/reference';
import { COLLECTIONS } from './types';
import { canReview, canWrite } from './roles';
import { checkResponse } from './matching/contract';
import { runBaseline } from './matching/baseline';
import { buildLabels, evaluate } from './matching/eval';
import { requestForOpportunity } from './matching/requests';
import type { MatchCorpus } from './matching/types';

const NOW = new Date('2026-10-19T12:00:00Z');
const demo = buildSeed(NOW);
const corpus: MatchCorpus = { faculty: Object.values(demo.faculty), departments: demo.departments, projects: Object.values(demo.projects), publications: Object.values(demo.publications), ip: Object.values(demo.ip) };

describe('schemas', () => {
  it('every demo and live seed record is valid', () => {
    for (const db of [demo, buildLiveSeed(NOW)]) {
      for (const c of COLLECTIONS) {
        for (const r of Object.values(db[c])) {
          const v = validateRecord(c, r);
          if (!v.ok) throw new Error(`${c}/${(r as { id: string }).id}: ${v.error}`);
        }
      }
    }
  });
});

describe('roles', () => {
  it('maps roles to permissions', () => {
    expect(canReview({ role: 'staff', active: true })).toBe(false);
    expect(canReview({ role: 'reviewer', active: true })).toBe(true);
    expect(canReview({ role: 'admin', active: false })).toBe(false); // deactivated users lose rights
    expect(canWrite({ role: 'viewer', active: true }, 'feedback', 'put')).toBe(true);
    expect(canWrite({ role: 'viewer', active: true }, 'opportunities', 'put')).toBe(false);
    expect(canWrite({ role: 'staff', active: true }, 'users', 'put')).toBe(false);
    expect(canWrite({ role: 'admin', active: true }, 'reviews', 'delete')).toBe(false); // reviews are never deleted
  });
});

describe('matcher contract', () => {
  it('the baseline satisfies the contract', () => {
    for (const text of ['solid-state batteries', 'PFAS water treatment', 'unrecognisable words']) {
      const res = runBaseline({ text, engagementType: 'research', topics: [], disciplines: [], constraints: {} }, corpus, NOW);
      expect(checkResponse(res, corpus)).toEqual([]);
    }
  });

  it('flags invented researchers and unsorted results', () => {
    const res = runBaseline({ text: 'solid-state batteries', engagementType: 'research', topics: [], disciplines: [], constraints: {} }, corpus, NOW);
    const bad = { ...res, results: [{ ...res.results[1], rank: 1 }, { ...res.results[0], rank: 2, facultyId: 'f-ghost' }] };
    const v = checkResponse(bad, corpus).map((x) => x.message).join(' | ');
    expect(v).toMatch(/sorted/);
    expect(v).toMatch(/must not invent people/);
  });

  it('rejects a malformed response with readable paths', () => {
    expect(checkResponse({ providerId: 'x', results: [{ score: 500 }] })[0].path).toBeTruthy();
  });
});

describe('evaluation harness', () => {
  it('builds labels from outcomes, reviews and shortlists', () => {
    const labels = buildLabels(demo);
    expect(labels.length).toBeGreaterThan(3);
    const genomics = labels.find((l) => l.id === 'opp:o-arbor-genomics')!;
    expect(genomics.negatives).toContain('f-mccarthy'); // "wrong expertise" outcome
    const keyline = labels.find((l) => l.id === 'opp:o-keyline-freight');
    expect(keyline?.negatives ?? []).not.toContain('f-hollis'); // budget mismatch is not an algorithm error
  });

  it('computes bounded metrics for the baseline', () => {
    const labels = buildLabels(demo);
    const responses = new Map(labels.map((l) => [l.id, runBaseline(l.request, corpus, NOW)]));
    const r = evaluate('baseline', labels, responses);
    for (const k of ['hitAt1', 'hitAt3', 'hitAt5', 'mrr', 'recall'] as const) { expect(r[k]).toBeGreaterThanOrEqual(0); expect(r[k]).toBeLessThanOrEqual(1); }
    expect(r.hitAt5).toBeGreaterThanOrEqual(r.hitAt1);
  });

  it('derives a request for any opportunity', () => {
    const req = requestForOpportunity(demo, demo.opportunities['o-summit-recruit']);
    expect(req.engagementType).toBe('talent');
    expect(req.topics.length).toBeGreaterThan(0);
  });
});
