import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightLeft, CalendarClock, CheckCircle2, CircleDot, Database, ExternalLink, FileText, Flag, Handshake, Lightbulb, Mail,
  MessageSquare, Phone, PlusCircle, Radar, Send, Sparkles, Users,
} from 'lucide-react';
import { freshness, OPPORTUNITY_TYPES, STAGES, TYPE_BY_ID } from '@shared/rules';
import { BAND_LABEL } from '@shared/matching/baseline';
import type { Band, Confidence } from '@shared/matching/types';
import type { Activity, OpportunityType, Pathway, Priority, SourceRef, Stage } from '@shared/types';
import { cn } from '@/lib/cn';
import { daysSince, dueLabel, fmtDate, relTime } from '@/lib/format';
import { useDb } from '@/lib/store';
import { Avatar, Badge, type Tone } from './ui/primitives';
import { Tip } from './ui/overlays';
import { motion } from 'motion/react';
import { t } from '@/lib/motion';

/* ---------------- Company mark ---------------- */

export function CompanyMark({ name, size = 28 }: { name: string; size?: number }) {
  return <Avatar name={name} size={size} square />;
}

/* ---------------- Stage / type / pathway ---------------- */

/** Stage = a label plus its position in the workflow, so progress reads without color. */
export function StageBadge({ stage, compact }: { stage: Stage; compact?: boolean }) {
  const s = STAGES.find((x) => x.id === stage)!;
  const idx = STAGES.findIndex((x) => x.id === stage);
  const total = STAGES.length - 1; // "closed" sits outside the forward flow
  const closed = stage === 'closed';
  return (
    <Tip content={s.description}>
      <span className="inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-sm bg-subtle pl-1.5 pr-1.5 text-[11.5px] font-medium text-ink-2" aria-label={`Stage: ${s.label}`}>
        {!closed && (
          <span className="flex gap-[2px]" aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={cn('h-2 w-[3px] rounded-[1px]', i <= idx ? (stage === 'outcome' ? 'bg-good' : 'bg-accent') : 'bg-line-strong/70')} />
            ))}
          </span>
        )}
        {closed && <span className="h-2 w-2 rounded-full ring-[1.5px] ring-inset ring-ink-4" aria-hidden />}
        {!compact && s.short}
        {compact && <span className="sr-only">{s.short}</span>}
      </span>
    </Tip>
  );
}

export const PATHWAY_META: Record<Pathway, { label: string; tone: Tone }> = {
  research: { label: 'Sponsored research', tone: 'accent' },
  talent: { label: 'Talent & recruiting', tone: 'talent' },
  engagement: { label: 'Brand & engagement', tone: 'brand' },
};

export function PathwayBadge({ pathway, short }: { pathway: Pathway; short?: boolean }) {
  const m = PATHWAY_META[pathway];
  return <Badge tone={m.tone}>{short ? m.label.split(' ')[0] : m.label}</Badge>;
}

export function TypeBadge({ type }: { type: OpportunityType }) {
  const t = TYPE_BY_ID[type];
  return <Badge tone={PATHWAY_META[t.pathway].tone}>{t.label}</Badge>;
}
export const typeLabel = (t: OpportunityType) => OPPORTUNITY_TYPES.find((x) => x.id === t)!.label;

export function PriorityDot({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const c = { high: 'bg-bad', medium: 'bg-warn', low: 'bg-ink-4' }[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-3" title={`${priority} priority`}>
      <span className={cn('h-2 w-2 rounded-full', c)} />
      {withLabel && <span className="capitalize">{priority}</span>}
    </span>
  );
}

export function DueBadge({ iso, done }: { iso?: string; done?: boolean }) {
  if (!iso) return null;
  const d = dueLabel(iso);
  if (done) return <span className="text-xs text-ink-4 line-through">{d.text}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular', d.tone === 'bad' ? 'text-bad font-medium' : d.tone === 'warn' ? 'text-warn font-medium' : 'text-ink-3')}>
      <CalendarClock className="h-3 w-3" />{d.text}
    </span>
  );
}

/* ---------------- Freshness & confidence ---------------- */

export function FreshnessBadge({ iso, compact }: { iso?: string; compact?: boolean }) {
  const f = freshness(iso);
  const days = daysSince(iso);
  const map = {
    fresh: { tone: 'good' as Tone, label: 'Current' },
    aging: { tone: 'warn' as Tone, label: 'Aging' },
    stale: { tone: 'bad' as Tone, label: 'Stale' },
    unknown: { tone: 'neutral' as Tone, label: 'Unverified' },
  }[f];
  const tip = iso ? `Last verified ${fmtDate(iso)} (${days} days ago)` : 'Never verified';
  return (
    <Tip content={tip}>
      <span><Badge tone={map.tone} dot>{compact ? map.label : `${map.label}${iso ? ` · ${days < 60 ? `${days}d` : `${Math.round(days / 30)}mo`}` : ''}`}</Badge></span>
    </Tip>
  );
}

/** Evidence confidence: three steps, deliberately a different shape from the relevance score. */
export function EvidenceMark({ level, className }: { level: Confidence['level']; className?: string }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const c = level === 'high' ? 'bg-good' : level === 'medium' ? 'bg-warn' : 'bg-bad';
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden>
      {[0, 1, 2].map((i) => <span key={i} className={cn('w-[3px] rounded-[1px]', i < n ? c : 'bg-line-strong/80')} style={{ height: 5 + i * 3 }} />)}
    </span>
  );
}

export function ConfidencePill({ c, showScore }: { c: Confidence; showScore?: boolean }) {
  const label = c.level === 'high' ? 'High' : c.level === 'medium' ? 'Medium' : 'Low';
  return (
    <Tip content={<div className="space-y-0.5"><div className="mb-1 font-semibold">Evidence confidence — how far to trust the record</div>{c.factors.map((f) => <div key={f.label} className="flex justify-between gap-4"><span>{f.label}</span><span className="opacity-70">{f.detail}</span></div>)}</div>}>
      <span className="inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-[11.5px] font-medium text-ink-2 ring-1 ring-inset ring-line-strong/70">
        <EvidenceMark level={c.level} />{label} evidence{showScore ? <span className="meta">· {c.score}</span> : null}
      </span>
    </Tip>
  );
}

export const BAND_TONE: Record<Band, { ring: string; text: string; soft: string; tone: Tone; bar: string }> = {
  strong: { ring: 'rgb(var(--good))', text: 'text-good', soft: 'bg-good-soft', tone: 'good', bar: 'bg-good' },
  good: { ring: 'rgb(var(--accent))', text: 'text-accent', soft: 'bg-accent-soft', tone: 'accent', bar: 'bg-accent' },
  possible: { ring: 'rgb(var(--warn))', text: 'text-warn', soft: 'bg-warn-soft', tone: 'warn', bar: 'bg-warn' },
  weak: { ring: 'rgb(var(--ink-4))', text: 'text-ink-3', soft: 'bg-subtle', tone: 'neutral', bar: 'bg-ink-4' },
};

/**
 * Relevance score mark: a number on a 0–100 rule with band thresholds marked.
 * Not a dial: a dial implies a percentage/probability; this reads as a position on a scale.
 * `size` keeps the older API (44 ≈ list row, 64 ≈ inspector header).
 */
export function ScoreDial({ score, band, size = 44 }: { score: number; band: Band; size?: number; stroke?: number }) {
  const tone = BAND_TONE[band];
  const big = size >= 56;
  return (
    <div className="shrink-0" style={{ width: big ? 76 : 52 }} role="img" aria-label={`Relevance ${score} of 100, ${BAND_LABEL[band]}`}>
      <div className={cn('figure leading-none text-right', tone.text)} style={{ fontSize: big ? 30 : 20 }}>{score}</div>
      <div className="relative mt-1.5 h-[3px] w-full rounded-full bg-line">
        <motion.span className={cn('absolute inset-y-0 left-0 rounded-full origin-left', tone.bar)} style={{ width: '100%' }} initial={{ scaleX: 0 }} animate={{ scaleX: score / 100 }} transition={t.data} />
        {big && [45, 60, 75].map((x) => <span key={x} className="absolute -top-[2px] h-[7px] w-px bg-ink-4/50" style={{ left: `${x}%` }} />)}
      </div>
    </div>
  );
}

export function BandBadge({ band }: { band: Band }) {
  return <Badge tone={BAND_TONE[band].tone}>{BAND_LABEL[band]}</Badge>;
}

/* ---------------- Sources ---------------- */

export function SourceLine({ source, className }: { source: SourceRef; className?: string }) {
  const db = useDb();
  const s = db.sources[source.sourceId];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-3', className)}>
      <Database className="h-3 w-3" />
      <span>{source.label}</span>
      <span className="text-ink-4">· retrieved {relTime(source.retrievedAt)}</span>
      {s?.status === 'demo' && <span className="text-ink-4">· demo</span>}
      {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>source<ExternalLink className="h-3 w-3" /></a>}
    </span>
  );
}

/* ---------------- People ---------------- */

export function UserName({ id, withAvatar }: { id?: string; withAvatar?: boolean }) {
  const db = useDb();
  const u = id ? db.users[id] : undefined;
  if (!u) return <span className="text-ink-4">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {withAvatar && <Avatar name={u.name} size={20} />}
      <span>{u.name}</span>
    </span>
  );
}

export function FacultyLink({ id, className, children }: { id: string; className?: string; children?: ReactNode }) {
  const db = useDb();
  const f = db.faculty[id];
  if (!f) return <span className="text-ink-4">Unknown researcher</span>;
  return <Link to={`/faculty/${id}`} className={cn('hover:text-accent hover:underline underline-offset-2', className)}>{children ?? f.name}</Link>;
}

export function CompanyLink({ id, className }: { id: string; className?: string }) {
  const db = useDb();
  const c = db.companies[id];
  if (!c) return <span className="text-ink-4">Unknown company</span>;
  return <Link to={`/companies/${id}`} className={cn('hover:text-accent hover:underline underline-offset-2', className)}>{c.name}</Link>;
}

/* ---------------- Activity feed ---------------- */

const ACT_ICON: Record<Activity['kind'], ReactNode> = {
  'stage-change': <ArrowRightLeft />, note: <MessageSquare />, review: <CheckCircle2 />, 'intro-draft': <FileText />,
  'intro-recorded': <Send />, meeting: <Users />, call: <Phone />, 'email-logged': <Mail />, match: <Sparkles />,
  created: <PlusCircle />, outcome: <Flag />, signal: <Radar />, data: <Database />, task: <CalendarClock />,
};

export function ActivityFeed({ items, limit, showContext = true, empty = 'No activity yet.' }: { items: Activity[]; limit?: number; showContext?: boolean; empty?: string }) {
  const db = useDb();
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (!sorted.length) return <p className="text-sm text-ink-3 py-4">{empty}</p>;
  return (
    <ol className="relative">
      {sorted.map((a, i) => {
        const opp = a.opportunityId ? db.opportunities[a.opportunityId] : undefined;
        const co = a.companyId ? db.companies[a.companyId] : undefined;
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < sorted.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-line" />}
            <span className={cn('relative z-[1] mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-line text-ink-3 [&>svg]:h-3 [&>svg]:w-3',
              a.kind === 'intro-recorded' && 'text-accent ring-accent-line', a.kind === 'outcome' && 'text-good ring-good/30')}>
              {ACT_ICON[a.kind] ?? <CircleDot />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink leading-snug">{a.text}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {db.users[a.actorId]?.name ?? 'Someone'} · {relTime(a.at)}
                {showContext && opp && <> · <Link className="hover:text-accent" to={`/opportunities/${opp.id}`}>{opp.title}</Link></>}
                {showContext && !opp && co && <> · <Link className="hover:text-accent" to={`/companies/${co.id}`}>{co.name}</Link></>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Misc ---------------- */

export function DemoTag({ children = 'Fictional demo data' }: { children?: ReactNode }) {
  return <Badge tone="demo"><Lightbulb className="h-3 w-3" />{children}</Badge>;
}

export function HandshakeIcon() { return <Handshake />; }

export function InfoNote({ children, tone = 'neutral', icon, className }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'accent' | 'good'; icon?: ReactNode; className?: string }) {
  // A ruled note, not a box: context should sit beside content, not compete with it.
  const tc = { neutral: 'border-line-strong text-ink-2 [&>svg]:text-ink-3', warn: 'border-warn bg-warn-soft/40 text-ink [&>svg]:text-warn', accent: 'border-accent-line text-ink-2 [&>svg]:text-accent', good: 'border-good/60 text-ink [&>svg]:text-good' }[tone];
  return (
    <div className={cn('flex gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-[13px] leading-snug [&>svg]:mt-[1px] [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0', tc, className)}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
