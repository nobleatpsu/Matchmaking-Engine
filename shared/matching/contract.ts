/**
 * The matcher contract, executable.
 *
 * `checkResponse` validates any MatchResponse — from the baseline, a
 * TypeScript provider or a remote HTTP service — against the shape the UI
 * depends on AND the invariants the product promises (sorted, explainable,
 * scores in range, no invented researchers). The server runs it on every
 * external response; `npm run matcher:check` runs it on fixtures.
 */
import { z } from 'zod';
import type { MatchCorpus, MatchResponse } from './types';

const component = z.object({
  key: z.enum(['topic', 'expertise', 'active', 'evidence', 'pathway']),
  label: z.string(), weight: z.number().min(0).max(1), score: z.number().min(0).max(100).nullable(), explanation: z.string(),
});

const result = z.object({
  facultyId: z.string(), rank: z.number().int().min(1), score: z.number().min(0).max(100),
  band: z.enum(['strong', 'good', 'possible', 'weak']),
  components: z.array(component).min(1),
  adjustments: z.array(z.object({ label: z.string(), points: z.number(), explanation: z.string() })),
  concepts: z.array(z.object({ concept: z.string(), strength: z.number().min(0).max(1), direct: z.boolean(), via: z.array(z.string()) })),
  evidence: z.array(z.object({
    type: z.enum(['expertise', 'keyword', 'summary', 'project', 'publication', 'ip']), id: z.string().optional(), title: z.string(),
    detail: z.string().optional(), date: z.string().optional(), concepts: z.array(z.string()), strength: z.number().min(0).max(1), active: z.boolean().optional(),
  })),
  unknowns: z.array(z.string()), concerns: z.array(z.string()),
  confidence: z.object({ score: z.number().min(0).max(100), level: z.enum(['high', 'medium', 'low']), factors: z.array(z.object({ label: z.string(), value: z.number(), detail: z.string() })) }),
  summary: z.string(), pathways: z.array(z.string()), relatedProjectIds: z.array(z.string()), relatedIpIds: z.array(z.string()),
});

export const matchResponseSchema = z.object({
  providerId: z.string().min(1), providerVersion: z.string(), generatedAt: z.string(), method: z.string(),
  requestConcepts: z.array(z.string()), inferredConcepts: z.array(z.string()),
  results: z.array(result), excluded: z.array(z.object({ facultyId: z.string(), reason: z.string() })), considered: z.number().int().min(0),
});

export interface ContractViolation { path: string; message: string }

export function checkResponse(res: unknown, corpus?: MatchCorpus): ContractViolation[] {
  const parsed = matchResponseSchema.safeParse(res);
  if (!parsed.success) return parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message }));
  const r = parsed.data as MatchResponse;
  const v: ContractViolation[] = [];
  const known = corpus ? new Set(corpus.faculty.map((f) => f.id)) : null;
  const seen = new Set<string>();
  r.results.forEach((x, i) => {
    if (x.rank !== i + 1) v.push({ path: `results.${i}.rank`, message: `ranks must be 1..n in order (got ${x.rank} at position ${i + 1})` });
    if (i > 0 && x.score > r.results[i - 1].score && r.results[i - 1].rank < x.rank) v.push({ path: `results.${i}.score`, message: 'results must be sorted by score, highest first' });
    if (seen.has(x.facultyId)) v.push({ path: `results.${i}.facultyId`, message: 'duplicate researcher' });
    seen.add(x.facultyId);
    if (known && !known.has(x.facultyId)) v.push({ path: `results.${i}.facultyId`, message: `unknown researcher “${x.facultyId}” — providers must not invent people` });
    if (!x.summary.trim()) v.push({ path: `results.${i}.summary`, message: 'every result needs a plain-language summary' });
    if (x.components.every((c) => c.score === null)) v.push({ path: `results.${i}.components`, message: 'at least one component must be assessed' });
    if (corpus) {
      const ids = new Set([...corpus.projects.map((p) => p.id), ...corpus.publications.map((p) => p.id), ...corpus.ip.map((p) => p.id)]);
      x.evidence.forEach((e, j) => { if (e.id && !ids.has(e.id)) v.push({ path: `results.${i}.evidence.${j}.id`, message: `unknown evidence record “${e.id}”` }); });
    }
  });
  return v;
}
