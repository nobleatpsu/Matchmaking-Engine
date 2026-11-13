/** Compatibility reader for Ian's precomputed result-file contract (v0.2).
 * This intentionally does not feed or alter the application's native matcher.
 */
export type IanBand = 'strong' | 'moderate' | 'weak' | 'insufficient';
export type IanComponent = 'topical_fit' | 'recency' | 'evidence_strength' | 'company_quality' | 'psu_link';
const components: IanComponent[] = ['topical_fit', 'recency', 'evidence_strength', 'company_quality', 'psu_link'];
export type IanResultFile = {
  schema_version: '0.2'; workflow: 'company_need_to_researchers' | 'researcher_to_companies'; synthetic: boolean; run_id: string; generated_at: string; note: string;
  query: { id: string; kind: string; display_name: string; summary: string };
  evidence: Record<string, { id: string; kind: string; text: string; date?: string | null; provenance: { source_type: string; source_ref: string; retrieved_at?: string | null } }>;
  results: Array<{ rank: number | null; candidate: { id: string; display_name: string; kind: 'company' | 'researcher'; detail?: string | null }; match: {
    query_id: string; candidate_id: string; score: number | null; band: IanBand; headline: string; generated_at: string;
    breakdown: { topical_fit: number | null; recency: number | null; evidence_strength: number | null; company_quality: number | null; psu_link: number | null; weights: Record<IanComponent, number> };
    reasons: Array<{ text: string; evidence_ids: string[] }>; uncertainty: Array<{ code: string; note: string }>;
    not_checked: string[]; method: { scorer: string; scorer_version: string; model_id?: string | null; prompt_version?: string | null; note?: string | null }; synthetic: boolean;
  } }>;
};

export type IanIndexEntry = { file: string; workflow: IanResultFile['workflow']; query_id: string; query_name: string; run_id: string; entries: number; ranked: number; bands: Partial<Record<IanBand, number>>; flags: string[]; synthetic: boolean };

const bands: IanBand[] = ['strong', 'moderate', 'weak', 'insufficient'];
const expectedKinds = {
  company_need_to_researchers: { query: 'company_need', candidate: 'researcher' },
  researcher_to_companies: { query: 'researcher', candidate: 'company' },
} as const;

const validScore = (value: unknown) => typeof value === 'number' && value >= 0 && value <= 100;
export function validateIanResult(value: unknown): string[] {
  const d = value as Partial<IanResultFile>;
  const errors: string[] = [];
  if (!d || typeof d !== 'object') return ['Result file is not an object.'];
  if (d.workflow !== 'company_need_to_researchers' && d.workflow !== 'researcher_to_companies') errors.push('Invalid workflow.');
  if (d.schema_version !== '0.2') errors.push('Unsupported or missing schema version.');
  if (!d.query?.id || !d.query.display_name || !d.query.summary || !d.run_id || !d.generated_at || !Array.isArray(d.results) || !d.evidence) errors.push('Missing required top-level result fields.');
  const expected = expectedKinds[d.workflow as keyof typeof expectedKinds];
  if (expected && d.query?.kind !== expected.query) errors.push('Workflow and query kind disagree.');
  const seen = new Set<string>();
  const ranks: Array<number | null> = [];
  const scores: number[] = [];
  d.results?.forEach((row, i) => {
    const m = row?.match; const prefix = `Result ${i + 1}`;
    if (!row?.candidate?.id || !m?.candidate_id || row.candidate.id !== m.candidate_id || m.query_id !== d.query?.id) errors.push(`${prefix} has inconsistent stable IDs.`);
    if (!bands.includes(m?.band as IanBand)) errors.push(`${prefix} has an invalid band.`);
    if (seen.has(m?.candidate_id ?? '')) errors.push(`${prefix} duplicates a candidate ID.`); seen.add(m?.candidate_id ?? '');
    if (!row?.candidate?.display_name || !m?.headline || !m?.generated_at || !Array.isArray(m?.not_checked) || !m.not_checked.length) errors.push(`${prefix} is missing display metadata or required review boundaries.`);
    if (expected && row?.candidate?.kind !== expected.candidate) errors.push(`${prefix} candidate kind does not match the workflow.`);
    if (m?.score !== null && !validScore(m?.score)) errors.push(`${prefix} has an invalid score.`);
    if (m?.band === 'insufficient' && (m.score !== null || row.rank !== null)) errors.push(`${prefix} insufficient entry must not have score or rank.`);
    if (m?.band !== 'insufficient' && (m.score === null || row.rank === null)) errors.push(`${prefix} ranked entry is missing score or rank.`);
    if (m?.score != null && ((m.band === 'strong' && m.score < 75) || (m.band === 'moderate' && (m.score < 50 || m.score >= 75)) || (m.band === 'weak' && m.score >= 50))) errors.push(`${prefix} score and band disagree.`);
    if (m?.breakdown?.topical_fit != null && m.breakdown.topical_fit < 40 && m.band !== 'weak') errors.push(`${prefix} topical-fit gate and band disagree.`);
    const breakdown = m?.breakdown;
    if (!breakdown || components.some((key) => breakdown[key] !== null && !validScore(breakdown[key]))) errors.push(`${prefix} has an invalid score component.`);
    const weights = breakdown?.weights;
    if (!weights || components.some((key) => typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 1) || Math.abs(components.reduce((sum, key) => sum + (weights?.[key] ?? 0), 0) - 1) > 0.0001) errors.push(`${prefix} has invalid scoring weights.`);
    if (m?.score !== null && breakdown && weights && components.some((key) => (breakdown[key] === null) !== (weights[key] === 0))) errors.push(`${prefix} treats an unknown component as a scored value.`);
    if (m?.reasons?.some((r) => r.evidence_ids.some((id) => !d.evidence?.[id]))) errors.push(`${prefix} references missing evidence.`);
    ranks.push(row?.rank ?? null);
    if (typeof m?.score === 'number' && row?.rank !== null) scores.push(m.score);
  });
  const ranked = ranks.filter((rank): rank is number => rank !== null);
  if (ranks.some((rank, i) => rank === null && ranks.slice(i + 1).some((later) => later !== null)) || ranked.some((rank, i) => rank !== i + 1)) errors.push('Results must be ranked consecutively with unranked entries last.');
  if (scores.some((score, i) => i > 0 && score > scores[i - 1])) errors.push('Ranked results are not in descending score order.');
  Object.entries(d.evidence ?? {}).forEach(([id, evidence]) => { if (id !== evidence?.id) errors.push(`Evidence key ${id} does not match its record.`); });
  return errors;
}

export const isHttpSource = (source?: string | null) => /^https?:\/\//i.test(source ?? '');
