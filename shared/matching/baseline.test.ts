import { describe, expect, it } from 'vitest';
import { buildSeed } from '../seed';
import type { Database, MatchRequest } from '../types';
import { bandFor, explainRanking, runBaseline } from './baseline';
import type { MatchCorpus } from './types';

const NOW = new Date('2026-10-19T12:00:00Z');
const db: Database = buildSeed(NOW);
const corpus: MatchCorpus = {
  faculty: Object.values(db.faculty),
  departments: db.departments,
  projects: Object.values(db.projects),
  publications: Object.values(db.publications),
  ip: Object.values(db.ip),
};

const req = (over: Partial<MatchRequest> = {}): MatchRequest => ({
  text: 'We are an energy company looking to collaborate with researchers working on solid-state batteries, energy storage, and sustainable manufacturing.',
  engagementType: 'research',
  topics: [],
  disciplines: [],
  constraints: {},
  ...over,
});

describe('baseline matcher', () => {
  it('extracts concepts from free text', () => {
    const r = runBaseline(req(), corpus, NOW);
    expect(r.requestConcepts).toEqual(expect.arrayContaining(['solid-state-batteries', 'energy-storage', 'sustainable-materials']));
  });

  it('ranks battery researchers at the top for an energy-storage request', () => {
    const r = runBaseline(req(), corpus, NOW);
    const top3 = r.results.slice(0, 3).map((x) => x.facultyId);
    expect(top3).toContain('f-okafor');
    expect(top3).toContain('f-lindqvist');
    // Unrelated researchers are not returned at all.
    expect(r.results.find((x) => x.facultyId === 'f-abernathy')).toBeUndefined();
  });

  it('is deterministic', () => {
    const a = runBaseline(req(), corpus, NOW);
    const b = runBaseline(req(), corpus, NOW);
    expect(a.results.map((x) => [x.facultyId, x.score])).toEqual(b.results.map((x) => [x.facultyId, x.score]));
  });

  it('scores are a reproducible function of the components', () => {
    const r = runBaseline(req(), corpus, NOW).results[0];
    const known = r.components.filter((c) => c.score !== null);
    const wsum = known.reduce((s, c) => s + c.weight, 0);
    const base = known.reduce((s, c) => s + c.weight * (c.score as number), 0) / wsum;
    const adj = r.adjustments.reduce((s, a) => s + a.points, 0);
    expect(r.score).toBe(Math.max(0, Math.min(100, Math.round(base + adj))));
    expect(r.band).toBe(bandFor(r.score));
  });

  it('keeps researchers without patents eligible', () => {
    const r = runBaseline(req(), corpus, NOW);
    const chandra = r.results.find((x) => x.facultyId === 'f-chandra');
    expect(chandra).toBeDefined();
    expect(corpus.ip.some((i) => i.facultyIds.includes('f-chandra'))).toBe(false);
    expect(chandra!.score).toBeGreaterThanOrEqual(60);
  });

  it('separates match quality from evidence confidence for sparse records', () => {
    const r = runBaseline(req({ text: 'grid-scale energy storage siting with renewables for a utility' }), corpus, NOW);
    const reyes = r.results.find((x) => x.facultyId === 'f-reyes')!;
    expect(reyes.score).toBeGreaterThanOrEqual(70); // strong topical fit…
    expect(reyes.confidence.level).toBe('low'); // …but stale, single-source record
    expect(reyes.unknowns.join(' ')).toMatch(/Only one project/);
  });

  it('applies the require-IP constraint as a hard filter with a reason', () => {
    const r = runBaseline(req({ constraints: { requireIP: true } }), corpus, NOW);
    expect(r.results.every((x) => x.relatedIpIds.length > 0)).toBe(true);
    expect(r.excluded.find((x) => x.facultyId === 'f-chandra')?.reason).toMatch(/IP/);
  });

  it('penalises recorded unavailability rather than hiding it', () => {
    const r = runBaseline(req({ text: 'statistical machine learning for clinical trial data' }), corpus, NOW);
    const g = r.results.find((x) => x.facultyId === 'f-greenberg')!;
    expect(g.adjustments.some((a) => a.points < 0)).toBe(true);
    expect(g.concerns).toContain('Recorded as unavailable');
  });

  it('licensing requests reward available IP', () => {
    const r = runBaseline(req({ engagementType: 'licensing', text: 'license PFAS water treatment technology' }), corpus, NOW);
    const top = r.results[0];
    expect(top.facultyId).toBe('f-castillo');
    expect(top.components.find((c) => c.key === 'pathway')!.score).toBe(100);
  });

  it('explains why one candidate outranks another', () => {
    const r = runBaseline(req(), corpus, NOW);
    const e = explainRanking(r.results[0], r.results[3]);
    expect(e.scoreDelta).toBeGreaterThanOrEqual(0);
    expect(e.diffs).toHaveLength(5);
  });
});
