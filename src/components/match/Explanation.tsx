import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, ChevronDown, CircleHelp, FileBox, FlaskConical, Info, Lightbulb } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import { BAND_LABEL, WEIGHTS } from '@shared/matching/baseline';
import type { EvidenceItem, MatchResult } from '@shared/matching/types';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { Badge, Meter } from '../ui/primitives';
import { Tip } from '../ui/overlays';
import { BAND_TONE, EvidenceMark, ScoreDial } from '../domain';

export function ScoreHeader({ r, total }: { r: MatchResult; total?: number }) {
  return (
    <div className="flex items-start gap-4">
      <ScoreDial score={r.score} band={r.band} size={64} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-[14px] font-semibold', BAND_TONE[r.band].text)}>{BAND_LABEL[r.band]}</span>
          <span className="meta">relevance {r.score} / 100{total ? ` · rank ${r.rank} of ${total}` : ''}</span>
        </div>
        <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{r.summary}</p>
      </div>
    </div>
  );
}

export function ScoreBreakdown({ r }: { r: MatchResult }) {
  const [open, setOpen] = useState(false);
  const known = r.components.filter((c) => c.score !== null);
  const wsum = known.reduce((s, c) => s + c.weight, 0);
  return (
    <div>
      <div className="space-y-3">
        {r.components.map((c) => {
          const effective = c.score === null ? 0 : Math.round((c.weight / wsum) * 100);
          return (
            <div key={c.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{c.label} <span className="meta">· weight {Math.round(c.weight * 100)}%{c.score !== null && effective !== Math.round(c.weight * 100) ? ` → ${effective}%` : ''}</span></span>
                {c.score === null
                  ? <Tip content="No data to judge this. Its weight was shared among the other components, and evidence confidence was lowered instead."><span className="inline-flex items-center gap-1 text-xs text-ink-3"><CircleHelp className="h-3.5 w-3.5" />Not assessed</span></Tip>
                  : <span className="text-sm font-semibold tabular text-ink">{c.score}</span>}
              </div>
              {c.score === null ? <div className="unknown-hatch mt-1.5 h-1.5 rounded-full" aria-label="Not assessed" /> : <Meter className="mt-1.5" value={c.score} tone="navy" height={5} />}
              <p className="mt-1 text-xs text-ink-3">{c.explanation}</p>
            </div>
          );
        })}
        {r.adjustments.map((a) => (
          <div key={a.label} className="flex items-start justify-between gap-3 border-l-2 border-line-strong py-0.5 pl-3 text-xs">
            <span><span className="font-medium text-ink-2">{a.label}:</span> <span className="text-ink-3">{a.explanation}</span></span>
            <span className={cn('font-semibold tabular', a.points < 0 ? 'text-bad' : 'text-good')}>{a.points > 0 ? '+' : ''}{a.points}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink" aria-expanded={open}>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />How is this score calculated?
      </button>
      {open && (
        <div className="mt-2 rounded-md bg-canvas p-3 text-xs leading-relaxed text-ink-2 ring-1 ring-line animate-slide-up">
          <p>Score = weighted average of the assessed components ({Object.entries(WEIGHTS).map(([k, w]) => `${k} ${Math.round(w * 100)}%`).join(', ')}), plus adjustments. Components with no data are left out and their weight is redistributed.</p>
          <p className="mt-1.5">Topic coverage credits direct evidence fully and adjacent fields at half. Recent and active work counts more than older work. The same request always produces the same ranking.</p>
          <p className="mt-1.5 font-medium">A score ranks evidence of relevant expertise. It says nothing about availability or willingness to collaborate.</p>
        </div>
      )}
    </div>
  );
}

export function CoverageTable({ r }: { r: MatchResult }) {
  return (
    <div className="divide-y divide-line rounded-md ring-1 ring-line">
      {r.concepts.map((c) => (
        <div key={c.concept} className="flex items-center gap-3 px-3 py-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', c.strength >= 0.75 ? 'bg-good' : c.strength > 0 ? 'ring-2 ring-inset ring-accent' : 'ring-1 ring-inset ring-ink-4 unknown-hatch')} aria-hidden />
          <span className="flex-1 text-sm text-ink">{conceptLabel(c.concept)}</span>
          <span className="text-right text-xs text-ink-3">
            {c.strength === 0 ? 'No evidence found' : `${c.direct ? 'Direct' : 'Adjacent'} · ${c.via.map((v) => ({ expertise: 'expertise', keyword: 'keywords', summary: 'summary', project: 'projects', publication: 'publications', ip: 'IP' })[v]).join(', ')}`}
          </span>
        </div>
      ))}
    </div>
  );
}

const EV_ICON = { project: <FileBox />, publication: <BookOpen />, ip: <FlaskConical />, expertise: <Lightbulb />, keyword: <Lightbulb />, summary: <Lightbulb /> };

export function EvidenceList({ items, facultyId, limit = 6 }: { items: EvidenceItem[]; facultyId: string; limit?: number }) {
  const db = useDb();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  if (!items.length) return <p className="text-sm text-ink-3">No project, publication or IP records touch these topics. Relevance comes from listed expertise only.</p>;
  return (
    <div className="space-y-1.5">
      {shown.map((e) => {
        const src = e.type === 'project' ? db.projects[e.id!]?.source : e.type === 'publication' ? db.publications[e.id!]?.source : e.type === 'ip' ? db.ip[e.id!]?.source : undefined;
        const ip = e.type === 'ip' ? db.ip[e.id!] : undefined;
        return (
          <Link key={`${e.type}${e.id}`} to={`/faculty/${facultyId}?tab=${e.type === 'ip' ? 'ip' : 'research'}`} className="flex gap-2.5 rounded-md px-2.5 py-2 hover:bg-subtle [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-ink-4">
            {EV_ICON[e.type]}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink leading-snug">{e.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                <span className="capitalize">{e.type === 'ip' ? 'IP' : e.type}</span>
                {e.type === 'project' && (e.active ? <Badge tone="good" className="h-[18px] px-1.5">Active</Badge> : <span>Completed</span>)}
                {e.type === 'project' && e.date && <span>since {fmtDate(e.date, 'MMM yyyy')}</span>}
                {e.type === 'publication' && <span>{e.detail}</span>}
                {ip && <span>{ip.status.replace('-', ' ')} · licensing {ip.licensing}{ip.verified ? '' : ' · unverified'}</span>}
                {e.type === 'project' && e.detail && <span>{e.detail}</span>}
                <span className="text-ink-4">covers {e.concepts.map(conceptLabel).join(', ')}</span>
                {src && <span className="text-ink-4">· {src.label}</span>}
              </span>
            </span>
          </Link>
        );
      })}
      {items.length > limit && <button onClick={() => setAll(!all)} className="px-2.5 text-xs font-medium text-accent hover:underline">{all ? 'Show less' : `Show all ${items.length}`}</button>}
    </div>
  );
}

export function UnknownsAndConcerns({ r }: { r: MatchResult }) {
  return (
    <div className="grid gap-3">
      {r.concerns.length > 0 && (
        <div className="border-l-2 border-bad pl-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-bad"><AlertTriangle className="h-3.5 w-3.5" />Potential concerns or conflicts</div>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-2">{r.concerns.map((c) => <li key={c} className="flex gap-2"><span className="text-bad">•</span>{c}</li>)}</ul>
        </div>
      )}
      <div className="border-l-2 border-warn pl-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-warn"><CircleHelp className="h-3.5 w-3.5" />Unknown — confirm before any introduction</div>
        <p className="mt-0.5 text-[11.5px] text-ink-3">Missing information is not evidence against the researcher.</p>
        <ul className="mt-1.5 space-y-1 text-sm text-ink-2">{r.unknowns.map((c) => <li key={c} className="flex gap-2"><span className="text-warn">•</span>{c}</li>)}</ul>
      </div>
    </div>
  );
}

export function ConfidenceBreakdown({ r }: { r: MatchResult }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-ink"><EvidenceMark level={r.confidence.level} />Evidence confidence: <span className="capitalize">{r.confidence.level}</span></span>
        <span className="meta">{r.confidence.score}/100</span>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">How far to trust the underlying records — separate from how relevant the researcher is.</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {r.confidence.factors.map((f) => (
          <div key={f.label} className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[120px_1fr_140px]">
            <span className="text-ink-2">{f.label}</span>
            <Meter value={f.value} tone={f.value >= 70 ? 'good' : f.value >= 40 ? 'warn' : 'bad'} height={4} />
            <span className="truncate text-ink-3 max-sm:col-start-2 sm:text-right" title={f.detail}>{f.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotProof() {
  return (
    <div className="flex items-start gap-2 border-l-2 border-accent-line pl-3 text-xs text-ink-3">
      <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
      <span>Scores rank evidence of relevant expertise. They do not indicate availability, interest, or that an introduction is appropriate — a reviewer decides that.</span>
    </div>
  );
}
