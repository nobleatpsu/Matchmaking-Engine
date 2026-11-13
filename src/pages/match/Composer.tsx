import { useMemo, useState } from 'react';
import { ChevronDown, CornerDownLeft, Sparkles, Wand2 } from 'lucide-react';
import { extractConcepts } from '@shared/taxonomy';
import type { EngagementType, MatchRequest } from '@shared/types';
import { collegesOf } from '@/lib/colleges';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Kbd, Segmented, Select } from '@/components/ui/primitives';
import { TopicChips, TopicPicker } from '@/components/forms/Pickers';
import { EXAMPLES } from './examples';

export const ENGAGEMENT_OPTIONS: { value: EngagementType; label: string; short: string; hint: string }[] = [
  { value: 'research', label: 'Sponsored research', short: 'Research', hint: 'Faculty expertise, active projects, funding pathways' },
  { value: 'talent', label: 'Talent & recruiting', short: 'Talent', hint: 'Research groups and student pipelines' },
  { value: 'engagement', label: 'Brand & engagement', short: 'Engagement', hint: 'Events, seminars, visibility' },
  { value: 'licensing', label: 'Technology licensing', short: 'Licensing', hint: 'University IP, coordinated with OTT' },
];

/** Concepts shown as chips: explicit topics + detected-from-text, minus removed ones. */
export function effectiveTopics(r: MatchRequest) {
  const detected = extractConcepts([r.text, r.outcome, r.notes].filter(Boolean).join(' . '));
  const ex = new Set(r.excludedTopics ?? []);
  return { detected: detected.filter((d) => !ex.has(d) && !r.topics.includes(d)), explicit: r.topics };
}

export function Composer({ value, onChange, onRun, running, compact }: { value: MatchRequest; onChange: (r: MatchRequest) => void; onRun: () => void; running: boolean; compact?: boolean }) {
  const db = useDb();
  const [more, setMore] = useState(false);
  const set = <K extends keyof MatchRequest>(k: K, v: MatchRequest[K]) => onChange({ ...value, [k]: v });
  const { detected, explicit } = useMemo(() => effectiveTopics(value), [value]);
  const interests = Object.values(db.interests).filter((i) => i.companyId === value.companyId);
  const canRun = value.text.trim().length > 3 || explicit.length > 0;
  const nDetails = [value.outcome, value.budget, value.timeline, value.location, value.notes].filter(Boolean).length + value.disciplines.length + Object.values(value.constraints).filter(Boolean).length;

  return (
    <div className={cn('panel overflow-hidden', !compact && 'shadow-sm')}>
      <div className={cn(compact ? 'px-4 pt-3' : 'px-5 pt-4')}>
      <label htmlFor="need" className="flex items-baseline justify-between">
        <span className="eyebrow">Company need</span>
        <span className="text-xs text-ink-3">Plain language — topics are detected as you type</span>
      </label>
      <textarea
        id="need"
        rows={compact ? 3 : 5}
        value={value.text}
        onChange={(e) => set('text', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canRun) onRun(); }}
        placeholder="e.g. “We’re an energy company looking to collaborate with researchers on solid-state batteries and sustainable manufacturing.”"
        className="mt-1.5 w-full resize-none border-0 bg-transparent px-0 py-1 text-[17px] leading-[26px] tracking-[-0.005em] text-ink placeholder:text-ink-4 focus:outline-none"
      />

      <div className="mt-2 border-t border-dashed border-line pt-2.5 pb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3"><Wand2 className="h-3.5 w-3.5" />Research topics {detected.length + explicit.length ? <span className="font-normal">— detected automatically; remove or add freely</span> : null}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <TopicChips ids={detected} tone="accent" onRemove={(id) => set('excludedTopics', [...(value.excludedTopics ?? []), id])} />
          <TopicChips ids={explicit} onRemove={(id) => set('topics', explicit.filter((x) => x !== id))} />
          <TopicPicker size="sm" value={explicit} onChange={(ids) => onChange({ ...value, topics: ids, excludedTopics: (value.excludedTopics ?? []).filter((x) => !ids.includes(x)) })} />
          {!detected.length && !explicit.length && <span className="text-xs text-ink-3">Topics appear as you type.</span>}
        </div>
      </div>
      </div>

      <div className={cn('border-t border-line bg-canvas/50', compact ? 'px-4 py-3' : 'px-5 py-4')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company (optional)">
          <Select value={value.companyId ?? ''} onChange={(v) => onChange({ ...value, companyId: v || undefined, interestId: undefined })} placeholder="No specific company" options={Object.values(db.companies).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Company interest">
          <Select
            value={value.interestId ?? ''}
            onChange={(v) => {
              const i = db.interests[v];
              onChange({ ...value, interestId: v || undefined, ...(i && !value.text.trim() ? { text: i.description, topics: i.topics } : {}) });
            }}
            placeholder={value.companyId ? (interests.length ? 'Choose an interest…' : 'None recorded') : 'Pick a company first'}
            options={interests.map((i) => ({ value: i.id, label: i.title }))}
          />
        </Field>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-sm font-medium text-ink-2">Engagement type</div>
        <Segmented value={value.engagementType} onChange={(v) => set('engagementType', v)} options={ENGAGEMENT_OPTIONS.map((o) => ({ value: o.value, label: o.short, title: o.hint }))} className="w-full [&>button]:flex-1 [&>button]:justify-center" />
        <p className="mt-1.5 text-xs text-ink-3">{ENGAGEMENT_OPTIONS.find((o) => o.value === value.engagementType)?.hint}</p>
      </div>

      <button type="button" onClick={() => setMore(!more)} className="mt-4 flex w-full items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink" aria-expanded={more}>
        <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} />
        More details{nDetails > 0 && <span className="rounded bg-accent-soft px-1.5 text-2xs text-accent">{nDetails}</span>}
        <span className="ml-auto text-xs font-normal text-ink-4">Outcome, budget, timeline, constraints</span>
      </button>
      {more && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 animate-slide-up">
          <Field label="Desired outcome" className="sm:col-span-2"><input className="input" value={value.outcome ?? ''} onChange={(e) => set('outcome', e.target.value)} placeholder="e.g. A two-year sponsored project" /></Field>
          <Field label="Budget or funding range"><input className="input" value={value.budget ?? ''} onChange={(e) => set('budget', e.target.value)} placeholder="Unknown is fine" /></Field>
          <Field label="Timeline"><input className="input" value={value.timeline ?? ''} onChange={(e) => set('timeline', e.target.value)} placeholder="e.g. Start in spring" /></Field>
          <Field label="Location requirements"><input className="input" value={value.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="e.g. On-site testing in PA" /></Field>
          <Field label="Preferred disciplines" hint="Small boost, never a filter.">
            <Select value="" onChange={(v) => v && set('disciplines', [...new Set([...value.disciplines, v])])} placeholder={value.disciplines.length ? `${value.disciplines.length} selected — add another` : 'Any college'} options={collegesOf(db).map((c) => ({ value: c, label: c }))} />
          </Field>
          {value.disciplines.length > 0 && (
            <div className="sm:col-span-2 flex flex-wrap gap-1">
              {value.disciplines.map((d) => <button key={d} type="button" onClick={() => set('disciplines', value.disciplines.filter((x) => x !== d))} className="rounded bg-subtle px-2 py-0.5 text-xs text-ink-2 hover:bg-bad-soft hover:text-bad">{d} ×</button>)}
            </div>
          )}
          <div className="sm:col-span-2 space-y-2 rounded-md bg-surface p-3 ring-1 ring-line">
            <div className="text-xs font-semibold text-ink-2">Hard constraints</div>
            <Checkbox checked={!!value.constraints.requireIP} onChange={(v) => set('constraints', { ...value.constraints, requireIP: v })} label="Only researchers with related IP" description="Leave off for research matching — most strong collaborators have no patents." />
            <Checkbox checked={!!value.constraints.activeResearchOnly} onChange={(v) => set('constraints', { ...value.constraints, activeResearchOnly: v })} label="Only researchers with a related active project" />
            <Checkbox checked={!!value.constraints.requireVerifiedContact} onChange={(v) => set('constraints', { ...value.constraints, requireVerifiedContact: v })} label="Only verified contact details" />
          </div>
          <Field label="Additional notes" className="sm:col-span-2"><textarea className="input" rows={2} value={value.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      )}

      </div>
      <div className={cn('flex flex-wrap items-center gap-3 border-t border-line', compact ? 'px-4 py-2.5' : 'px-5 py-3')}>
        <p className="min-w-0 flex-1 text-xs text-ink-3">Results are a ranked starting point for a person to review. Nothing is sent to anyone.</p>
        <span className="hidden items-center gap-1 text-xs text-ink-3 sm:flex"><Kbd>⌘</Kbd><Kbd><CornerDownLeft className="h-2.5 w-2.5" /></Kbd></span>
        <Button variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />} disabled={!canRun} loading={running} onClick={onRun}>
          Find researchers
        </Button>
      </div>
    </div>
  );
}

export function ExamplePrompts({ onPick }: { onPick: (r: MatchRequest) => void }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {EXAMPLES.map((e) => (
        <li key={e.id}>
          <button onClick={() => onPick(e.request)} className="group flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors duration-fast hover:bg-surface/70">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink group-hover:text-accent">{e.label}</span>
              <span className="block text-xs text-ink-3">{e.company}</span>
              <span className="mt-0.5 line-clamp-1 text-xs text-ink-3">{e.request.text}</span>
            </span>
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-accent" />
          </button>
        </li>
      ))}
    </ul>
  );
}
