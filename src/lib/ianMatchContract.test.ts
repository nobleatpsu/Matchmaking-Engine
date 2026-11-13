import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isHttpSource, validateIanResult } from './ianMatchContract';

const base: any = { schema_version: '0.2', workflow: 'company_need_to_researchers', synthetic: true, run_id: 'r', generated_at: '2026-01-01', note: 'n', query: { id: 'q', kind: 'company_need', display_name: 'Q', summary: 's' }, evidence: {}, results: [{ rank: 1, candidate: { id: 'c', display_name: 'C', kind: 'researcher' }, match: { query_id: 'q', candidate_id: 'c', score: 75, band: 'strong', headline: 'h', generated_at: '2026-01-01', breakdown: { topical_fit: 90, recency: null, evidence_strength: 80, company_quality: null, psu_link: null, weights: { topical_fit: 0.625, recency: 0, evidence_strength: 0.375, company_quality: 0, psu_link: 0 } }, reasons: [], uncertainty: [], not_checked: ['conflict of interest'], method: { scorer: 'x', scorer_version: '1' }, synthetic: true } }] };
describe('Ian match contract compatibility', () => {
  it('accepts a ranked result and distinguishes web sources', () => { expect(validateIanResult(base)).toEqual([]); expect(isHttpSource('https://example.org')).toBe(true); expect(isHttpSource('market:ABC')).toBe(false); });
  it('reports duplicate and insufficient-shape violations', () => { const x = structuredClone(base); x.results.push({ ...x.results[0], match: { ...x.results[0].match, band: 'insufficient', score: 42 } }); expect(validateIanResult(x).join(' ')).toMatch(/duplicates|insufficient/i); });
  it('reports score-band inconsistencies without changing a score', () => { const x = structuredClone(base); x.results[0].match.band = 'weak'; expect(validateIanResult(x).join(' ')).toMatch(/score and band/i); });
  it('rejects output that drops review boundaries or scores unknown fields', () => { const x = structuredClone(base); x.results[0].match.not_checked = []; x.results[0].match.breakdown.weights.recency = 0.1; expect(validateIanResult(x).join(' ')).toMatch(/review boundaries|unknown component/i); });
  it('validates every packaged team output and its index metadata', () => {
    const root = resolve(process.cwd(), 'public/ian-matchmaking/for-noble');
    const index = JSON.parse(readFileSync(resolve(root, 'index.json'), 'utf8'));
    expect(index).toHaveLength(110);
    for (const entry of index) {
      const result = JSON.parse(readFileSync(resolve(root, entry.file), 'utf8'));
      expect(validateIanResult(result), entry.file).toEqual([]);
      expect({ workflow: result.workflow, query_id: result.query.id, run_id: result.run_id, entries: result.results.length, ranked: result.results.filter((row: any) => row.rank !== null).length, synthetic: result.synthetic }).toEqual({ workflow: entry.workflow, query_id: entry.query_id, run_id: entry.run_id, entries: entry.entries, ranked: entry.ranked, synthetic: entry.synthetic });
    }
  });
});
