import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import { explainRanking } from '@shared/matching/baseline';
import type { MatchResult } from '@shared/matching/types';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Avatar, Meter } from '../ui/primitives';
import { ConfidencePill, FreshnessBadge, ScoreDial, PATHWAY_META } from '../domain';

export function CompareView({ facultyIds, results }: { facultyIds: string[]; results?: Record<string, MatchResult> }) {
  const db = useDb();
  const people = facultyIds.map((id) => db.faculty[id]).filter(Boolean);
  const rs = results ? facultyIds.map((id) => results[id]) : [];
  const cols = `200px repeat(${people.length}, minmax(180px, 1fr))`;
  const best = (vals: (number | null | undefined)[]) => { const m = Math.max(...vals.map((v) => v ?? -1)); return vals.map((v) => v !== null && v !== undefined && v === m && vals.filter((x) => x === m).length < vals.length); };

  const Row = ({ label, hint, cells, highlight }: { label: string; hint?: string; cells: ReactNode[]; highlight?: boolean[] }) => (
    <div className="grid border-b border-line last:border-0" style={{ gridTemplateColumns: cols }}>
      <div className="px-4 py-3 bg-canvas/60">
        <div className="text-sm font-medium text-ink-2">{label}</div>
        {hint && <div className="text-xs text-ink-4">{hint}</div>}
      </div>
      {cells.map((c, i) => <div key={i} className={cn('px-4 py-3 text-sm text-ink border-l border-line', highlight?.[i] && 'bg-good-soft/50')}>{c}</div>)}
    </div>
  );

  const projectsOf = (id: string) => Object.values(db.projects).filter((p) => p.facultyIds.includes(id));
  const ipOf = (id: string) => Object.values(db.ip).filter((p) => p.facultyIds.includes(id));
  const concepts = rs[0]?.concepts.map((c) => c.concept) ?? [];

  return (
    <div className="overflow-x-auto scroll-thin rounded-lg ring-1 ring-line">
      <div className="min-w-fit">
        <div className="grid sticky top-0 z-[1] bg-surface border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div className="px-4 py-3 eyebrow self-end">Comparing {people.length}</div>
          {people.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2.5 border-l border-line px-4 py-3">
              <Avatar name={f.name} size={34} />
              <div className="min-w-0">
                <Link to={`/faculty/${f.id}`} className="block truncate text-sm font-semibold text-ink hover:text-accent">{f.name}</Link>
                <div className="truncate text-xs text-ink-3">{db.departments[f.departmentId]?.name}</div>
              </div>
              {rs[i] && <span className="ml-auto text-xs text-ink-4">#{rs[i].rank}</span>}
            </div>
          ))}
        </div>

        {rs.length > 0 && <>
          <Row label="Match score" hint="Deterministic, explainable" highlight={best(rs.map((r) => r.score))} cells={rs.map((r) => <div className="flex items-center gap-2"><ScoreDial score={r.score} band={r.band} size={38} /><span className="text-xs text-ink-3 capitalize">{r.band}</span></div>)} />
          {rs[0].components.map((c, ci) => (
            <Row key={c.key} label={c.label} hint={`weight ${Math.round(c.weight * 100)}%`}
              highlight={best(rs.map((r) => r.components[ci].score))}
              cells={rs.map((r) => {
                const s = r.components[ci].score;
                return s === null ? <span className="text-xs text-ink-4">Not assessed</span> : <div><div className="flex justify-between text-xs"><span className="tabular font-medium">{s}</span></div><Meter value={s} className="mt-1" height={5} /></div>;
              })} />
          ))}
          <Row label="Evidence confidence" hint="Trust in the record" highlight={best(rs.map((r) => r.confidence.score))} cells={rs.map((r) => <ConfidencePill c={r.confidence} showScore />)} />
          {concepts.length > 0 && (
            <Row label="Topic coverage" hint="Direct ✓ · adjacent ◐" cells={rs.map((r) => (
              <ul className="space-y-1">
                {r.concepts.map((c) => (
                  <li key={c.concept} className="flex items-center gap-1.5 text-xs">
                    {c.strength === 0 ? <Minus className="h-3.5 w-3.5 text-ink-4" /> : c.direct ? <Check className="h-3.5 w-3.5 text-good" strokeWidth={3} /> : <span className="h-3.5 w-3.5 text-center text-accent">◐</span>}
                    <span className={c.strength === 0 ? 'text-ink-4' : 'text-ink-2'}>{conceptLabel(c.concept)}</span>
                  </li>
                ))}
              </ul>
            ))} />
          )}
        </>}

        <Row label="Expertise" cells={people.map((f) => <div className="flex flex-wrap gap-1">{f.expertise.map((e) => <span key={e} className="rounded bg-subtle px-1.5 py-0.5 text-xs text-ink-2">{conceptLabel(e)}</span>)}</div>)} />
        <Row label="Active research" hint="Most relevant first" cells={people.map((f, i) => {
          const rel = rs[i]?.evidence.find((e) => e.type === 'project' && e.active);
          const act = projectsOf(f.id).filter((p) => p.status === 'active');
          return <div className="text-xs"><div className="text-ink">{rel?.title ?? act[0]?.title ?? <span className="text-ink-4">None listed</span>}</div><div className="mt-0.5 text-ink-3">{act.length} active · {projectsOf(f.id).length} total on file</div></div>;
        })} />
        <Row label="IP & commercialization" hint="One signal, not a requirement" cells={people.map((f) => {
          const ips = ipOf(f.id);
          return ips.length ? <div className="space-y-1 text-xs">{ips.slice(0, 2).map((p) => <div key={p.id}><span className="text-ink">{p.title}</span><div className="text-ink-3">{p.status.replace('-', ' ')} · licensing {p.licensing}</div></div>)}</div> : <span className="text-xs text-ink-4">No IP on file</span>;
        })} />
        <Row label="Collaboration suitability" cells={people.map((f) => (
          <div className="space-y-1 text-xs">
            <div>Availability: <span className={cn('font-medium capitalize', f.availability === 'open' ? 'text-good' : f.availability === 'unknown' ? 'text-ink-3' : 'text-warn')}>{f.availability}</span></div>
            <div>Group size: {f.labSize ?? 'unknown'}</div>
            <div className="flex flex-wrap gap-1">{f.interests.length ? f.interests.map((it) => <span key={it.pathway} className={cn('rounded px-1.5 py-0.5', it.verified ? 'bg-good-soft text-good' : 'bg-subtle text-ink-3')}>{PATHWAY_META[it.pathway].label.split(' ')[0]}{it.verified ? ' ✓' : ' ?'}</span>) : <span className="text-ink-4">No stated interests</span>}</div>
          </div>
        ))} />
        <Row label="Known constraints" cells={people.map((_, i) => rs[i]?.concerns.length ? <ul className="space-y-0.5 text-xs text-bad">{rs[i].concerns.map((c) => <li key={c}>{c}</li>)}</ul> : <span className="text-xs text-ink-4">None recorded</span>)} />
        <Row label="Open questions" cells={people.map((f, i) => <span className="text-xs text-ink-2">{rs[i] ? `${rs[i].unknowns.length} unknowns` : f.coverageNotes.join(' ') || '—'}</span>)} />
        <Row label="Data freshness" cells={people.map((f) => <div className="space-y-1"><FreshnessBadge iso={f.lastVerified} /><div className="text-xs text-ink-3">{f.sources.length} source{f.sources.length === 1 ? '' : 's'} · contact {f.emailVerified ? 'verified' : 'unverified'}</div></div>)} />
      </div>
    </div>
  );
}

export function RankingWhy({ a, b }: { a: MatchResult; b: MatchResult }) {
  const db = useDb();
  const e = explainRanking(a, b);
  const fa = db.faculty[a.facultyId].name;
  const fb = db.faculty[b.facultyId].name;
  const top = e.diffs.filter((d) => d.delta !== null && Math.abs(d.delta) >= 0.5).slice(0, 3);
  return (
    <div className="rounded-lg bg-canvas p-4 ring-1 ring-line/70">
      <div className="text-sm font-semibold text-ink">Why {fa} ranks {e.scoreDelta > 0 ? 'above' : e.scoreDelta < 0 ? 'below' : 'level with'} {fb} <span className="font-normal text-ink-3">({a.score} vs {b.score})</span></div>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
        {top.map((d) => (
          <li key={d.key} className="flex items-baseline gap-2">
            <span className={cn('w-12 shrink-0 text-right font-semibold tabular text-xs', (d.delta ?? 0) > 0 ? 'text-good' : 'text-bad')}>{(d.delta ?? 0) > 0 ? '+' : ''}{d.delta}</span>
            <span><b className="font-medium">{d.label}</b>: {d.a} vs {d.b}</span>
          </li>
        ))}
        {e.diffs.filter((d) => d.delta === null).map((d) => (
          <li key={d.key} className="flex items-baseline gap-2 text-ink-3"><span className="w-12 shrink-0 text-right text-xs">n/a</span><span>{d.label} not assessed for {d.a === null ? fa : fb} — weight redistributed</span></li>
        ))}
        {e.adjustmentDelta !== 0 && <li className="flex items-baseline gap-2"><span className="w-12 shrink-0 text-right font-semibold text-xs tabular">{e.adjustmentDelta > 0 ? '+' : ''}{e.adjustmentDelta}</span><span>Adjustments (discipline preference, availability)</span></li>}
      </ul>
      <p className="mt-2 text-xs text-ink-4">Points are each component’s contribution to the final score.</p>
    </div>
  );
}
