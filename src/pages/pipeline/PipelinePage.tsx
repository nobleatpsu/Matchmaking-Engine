import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ArrowDownUp, Ban, Columns3, List, Plus, Search, Lock, MoreHorizontal, ArrowRightLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { t } from '@/lib/motion';
import { OPPORTUNITY_TYPES, STAGES, STAGE_INDEX, TYPE_BY_ID, canTransition } from '@shared/rules';
import type { Opportunity, OpportunityType, Priority, Stage } from '@shared/types';
import { useDb, useMe } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { cn } from '@/lib/cn';
import { daysSince, dueLabel, fmtDate } from '@/lib/format';
import { moveWithChecks } from '@/lib/moveFlow';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarStack, Badge, Segmented, Select, Switch, EmptyState } from '@/components/ui/primitives';
import { Drawer, Menu, MenuItem, MenuLabel, Tip } from '@/components/ui/overlays';
import { CompanyMark, DueBadge, PATHWAY_META, PriorityDot, StageBadge, TypeBadge } from '@/components/domain';
import { OpportunityDetail } from '@/components/opportunity/OpportunityDetail';

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

export function PipelinePage() {
  const db = useDb();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openNewOpp = useUI((s) => s.openNewOpp);
  const [view, setViewState] = useState<'board' | 'table'>(read('keystone.pipelineView', 'board') as 'board' | 'table');
  const setView = (v: 'board' | 'table') => { setViewState(v); try { localStorage.setItem('keystone.pipelineView', v); } catch { /* */ } };
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('');
  const [type, setType] = useState<OpportunityType | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [overdue, setOverdue] = useState(params.get('overdue') === '1');
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<{ key: 'title' | 'stage' | 'followUp' | 'updated' | 'priority'; dir: 1 | -1 }>({ key: 'followUp', dir: 1 });
  const [dragId, setDragId] = useState<string | null>(null);
  const openId = params.get('open');
  const me = useMe();
  const view_ = { all: !owner && !type && !priority && !overdue, mine: owner === me.id && !overdue && !priority, overdue: overdue && !owner && !priority, high: priority === 'high' && !owner && !overdue };
  const applyView = (v: 'all' | 'mine' | 'overdue' | 'high') => {
    setOwner(v === 'mine' ? me.id : ''); setPriority(v === 'high' ? 'high' : ''); setOverdue(v === 'overdue'); setType('');
    try { localStorage.setItem('psrp.pipelineSavedView', v); } catch { /* */ }
  };

  const opps = useMemo(() => Object.values(db.opportunities).filter((o) => {
    const c = db.companies[o.companyId];
    if (q && !`${o.title} ${c?.name} ${o.facultyIds.map((f) => db.faculty[f]?.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (owner && o.ownerId !== owner) return false;
    if (type && o.type !== type) return false;
    if (priority && o.priority !== priority) return false;
    if (overdue && !(o.followUp && dueLabel(o.followUp).days < 0 && o.stage !== 'closed' && o.stage !== 'outcome')) return false;
    return true;
  }), [db, q, owner, type, priority, overdue]);

  const overdueCount = Object.values(db.opportunities).filter((o) => o.followUp && dueLabel(o.followUp).days < 0 && o.stage !== 'closed' && o.stage !== 'outcome').length;
  const dragging = dragId ? db.opportunities[dragId] : undefined;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const stages = STAGES.filter((s) => showClosed || s.id !== 'closed');

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setDragId(null);
    const to = e.over?.id as Stage | undefined;
    const id = String(e.active.id);
    if (!to || db.opportunities[id].stage === to) return;
    await moveWithChecks(id, to, navigate);
  };
  const open = (id: string) => setParams((p) => { p.set('open', id); return p; });

  const sorted = useMemo(() => [...opps].sort((a, b) => {
    const k = sort.key;
    const v = k === 'title' ? a.title.localeCompare(b.title)
      : k === 'stage' ? STAGE_INDEX[a.stage] - STAGE_INDEX[b.stage]
      : k === 'followUp' ? (a.followUp ?? '9999').localeCompare(b.followUp ?? '9999')
      : k === 'priority' ? ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]
      : b.updatedAt.localeCompare(a.updatedAt);
    return v * sort.dir;
  }), [opps, sort]);

  return (
    <Page wide className="max-w-none">
      <PageHeader
        title="Engagement Pipeline"
        description="Every opportunity by stage. Stage gates are enforced on the server — moving a card never contacts anyone."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openNewOpp()}>New opportunity</Button>}
        className="!mb-3"
      />

      <div className="mb-3 flex flex-wrap items-center gap-1" role="tablist" aria-label="Saved views">
        {([['all', 'All opportunities', Object.values(db.opportunities).filter((o) => o.stage !== 'closed').length], ['mine', 'Mine', Object.values(db.opportunities).filter((o) => o.ownerId === me.id && o.stage !== 'closed').length], ['overdue', 'Overdue', overdueCount], ['high', 'High priority', Object.values(db.opportunities).filter((o) => o.priority === 'high' && o.stage !== 'closed').length]] as const).map(([v, label, n]) => (
          <button key={v} role="tab" aria-selected={view_[v]} onClick={() => applyView(v)} className={cn('relative flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors duration-fast', view_[v] ? 'text-ink' : 'text-ink-3 hover:text-ink')}>
            {view_[v] && <motion.span layoutId="pipe-view" transition={t.layout} className="absolute inset-0 rounded-md bg-surface shadow-sm ring-1 ring-line" />}
            <span className="relative">{label}</span><span className={cn('relative font-mono text-[10.5px] tabular', v === 'overdue' && n > 0 ? 'text-bad' : 'text-ink-4')}>{n}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-line py-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-4" />
          <input className="input pl-8" placeholder="Search opportunities…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={owner} onChange={setOwner} placeholder="All owners" options={Object.values(db.users).filter((u) => u.team !== 'Project Team').map((u) => ({ value: u.id, label: u.name }))} aria-label="Owner" />
        <Select className="w-auto" value={type} onChange={setType} placeholder="All types" options={OPPORTUNITY_TYPES.map((t) => ({ value: t.id, label: t.label }))} aria-label="Type" />
        <Select className="w-auto" value={priority} onChange={setPriority} placeholder="Any priority" options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} aria-label="Priority" />
        <div className="ml-auto flex items-center gap-3">
          {view === 'board' && <Switch checked={showClosed} onChange={setShowClosed} label="Show closed" />}
          <Segmented value={view} onChange={setView} options={[{ value: 'board', label: 'Board', icon: <Columns3 className="h-3.5 w-3.5" /> }, { value: 'table', label: 'Table', icon: <List className="h-3.5 w-3.5" /> }]} />
        </div>
      </div>

      {view === 'board' ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto scroll-thin px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ minHeight: 'calc(100dvh - 300px)' }}>
            {stages.map((s) => {
              const cards = opps.filter((o) => o.stage === s.id).sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority] || (a.followUp ?? '9').localeCompare(b.followUp ?? '9'));
              const guard = dragging ? canTransition(dragging, s.id, db) : null;
              const notInWorkflow = dragging && !TYPE_BY_ID[dragging.type].stages.includes(s.id);
              return <Column key={s.id} stage={s.id} label={s.label} description={s.description} gate={GATES[s.id]} count={cards.length} dim={!!notInWorkflow} blocked={!!guard && !guard.ok && dragging?.stage !== s.id && !notInWorkflow} blockReason={guard && !guard.ok ? guard.reason : undefined}>
                {cards.map((o) => <Card key={o.id} o={o} onOpen={() => open(o.id)} onMove={(to) => moveWithChecks(o.id, to, navigate)} />)}
              </Column>;
            })}
          </div>
          <DragOverlay>{dragging && <CardBody o={dragging} lifted />}</DragOverlay>
        </DndContext>
      ) : (
        <div className="panel overflow-x-auto scroll-thin" tabIndex={0} role="region" aria-label="Opportunities table">
          <table className="w-full min-w-[960px] text-sm">
            <caption className="sr-only">Opportunities</caption>
            <thead className="sticky top-0 border-b border-line bg-canvas text-left text-[11.5px] font-medium uppercase tracking-[0.06em] text-ink-3">
              <tr>
                <Th label="Opportunity" k="title" sort={sort} setSort={setSort} />
                <th className="px-3 py-2.5 font-medium">Type</th>
                <Th label="Stage" k="stage" sort={sort} setSort={setSort} />
                <Th label="Priority" k="priority" sort={sort} setSort={setSort} />
                <th className="px-3 py-2.5 font-medium">Researchers</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium">Next action</th>
                <Th label="Follow-up" k="followUp" sort={sort} setSort={setSort} />
                <Th label="Updated" k="updated" sort={sort} setSort={setSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.length === 0 && <tr><td colSpan={9}><EmptyState title="No opportunities match these filters" /></td></tr>}
              {sorted.map((o) => (
                <tr key={o.id} className="row-hover cursor-pointer" onClick={() => open(o.id)}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5"><CompanyMark name={db.companies[o.companyId]?.name ?? '?'} size={26} /><div className="min-w-0"><div className="font-medium text-ink">{o.title}</div><div className="text-xs text-ink-3">{db.companies[o.companyId]?.name}</div></div></div>
                  </td>
                  <td className="px-3 py-2.5"><TypeBadge type={o.type} /></td>
                  <td className="px-3 py-2.5"><StageBadge stage={o.stage} /></td>
                  <td className="px-3 py-2.5"><PriorityDot priority={o.priority} withLabel /></td>
                  <td className="px-3 py-2.5">{o.facultyIds.length ? <AvatarStack names={o.facultyIds.map((f) => db.faculty[f]?.name ?? '?')} /> : <span className="text-ink-4">—</span>}</td>
                  <td className="px-3 py-2.5 text-ink-2">{db.users[o.ownerId]?.name}</td>
                  <td className="px-3 py-2.5 max-w-[260px] truncate text-ink-2">{o.nextAction ?? <span className="text-ink-4">—</span>}</td>
                  <td className="px-3 py-2.5"><DueBadge iso={o.stage === 'closed' || o.stage === 'outcome' ? undefined : o.followUp} /></td>
                  <td className="px-3 py-2.5 text-ink-3">{fmtDate(o.updatedAt, 'MMM d')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!openId && !!db.opportunities[openId]} onOpenChange={(o) => !o && setParams((p) => { p.delete('open'); return p; })} title="Opportunity" width={760}>
        {openId && db.opportunities[openId] && <OpportunityDetail id={openId} compact />}
      </Drawer>
    </Page>
  );
}

function Th({ label, k, sort, setSort }: { label: string; k: 'title' | 'stage' | 'followUp' | 'updated' | 'priority'; sort: { key: string; dir: 1 | -1 }; setSort: (s: { key: 'title' | 'stage' | 'followUp' | 'updated' | 'priority'; dir: 1 | -1 }) => void }) {
  const active = sort.key === k;
  return (
    <th className="px-3 py-2.5 font-medium" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')} onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}>
        {label}<ArrowDownUp className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  );
}

/** What a stage requires before an opportunity can enter it. Mirrors canTransition in shared/rules.ts. */
const GATES: Partial<Record<Stage, string>> = {
  'intro-prepared': 'Needs an approved review',
  'intro-recorded': 'Needs a draft recorded as sent',
  outcome: 'Needs a recorded outcome',
  closed: 'Needs a reason',
};

function Column({ stage, label, description, gate, count, children, dim, blocked, blockReason }: { stage: Stage; label: string; description: string; gate?: string; count: number; children: React.ReactNode; dim: boolean; blocked: boolean; blockReason?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: dim });
  return (
    <section ref={setNodeRef} aria-label={`${label}, ${count} opportunities`} className={cn('flex w-[272px] shrink-0 flex-col rounded-lg border transition-colors duration-base', isOver && !blocked ? 'border-accent/50 bg-accent-soft/60' : isOver && blocked ? 'border-bad/40 bg-bad-soft/50' : 'border-transparent bg-sunken/60', dim && 'opacity-40')}>
      <div className="px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2">
          <Tip content={description}><h2 className="text-[13px] font-semibold text-ink">{label}</h2></Tip>
          <span className="font-mono text-[11px] text-ink-3 tabular">{count}</span>
        </div>
        {gate && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-3"><Lock className="h-2.5 w-2.5" />{gate}</div>}
      </div>
      {dim && <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-md bg-surface px-2 py-1.5 text-2xs text-ink-3"><Ban className="h-3 w-3" />Not used by this workflow</div>}
      {blocked && isOver && <div className="mx-2 mb-2 rounded-md bg-surface px-2 py-1.5 text-2xs text-bad" role="status">{blockReason}</div>}
      <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5">{children}{count === 0 && <div className="flex-1 rounded-md border border-dashed border-line-strong/60 min-h-[56px]" />}</div>
    </section>
  );
}

function Card({ o, onOpen, onMove }: { o: Opportunity; onOpen: () => void; onMove: (to: Stage) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: o.id });
  return (
    <motion.div layout="position" layoutId={`opp-${o.id}`} transition={t.slow} className="group/card relative">
      <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} className={cn('rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent', isDragging && 'opacity-30')} aria-label={`${o.title}. Press space to pick up and move between stages, or use the move menu.`}>
        <CardBody o={o} />
      </div>
      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-fast group-hover/card:opacity-100 focus-within:opacity-100">
        <MoveMenu o={o} onMove={onMove} />
      </div>
    </motion.div>
  );
}

/** Keyboard and pointer alternative to drag-and-drop. Uses the same guarded move as dropping a card. */
function MoveMenu({ o, onMove }: { o: Opportunity; onMove: (to: Stage) => void }) {
  const db = useDb();
  const stages = TYPE_BY_ID[o.type].stages.filter((s) => s !== o.stage);
  return (
    <Menu trigger={<button className="flex h-6 w-6 items-center justify-center rounded bg-surface text-ink-3 shadow-sm ring-1 ring-line hover:text-ink" aria-label={`Move ${o.title}`}><MoreHorizontal className="h-3.5 w-3.5" /></button>}>
      <MenuLabel>Move to stage</MenuLabel>
      {stages.map((s) => {
        const g = canTransition(o, s, db);
        return <MenuItem key={s} icon={g.ok ? <ArrowRightLeft /> : <Lock />} onSelect={() => onMove(s)} hint={!g.ok ? 'gated' : undefined}>{STAGES[STAGE_INDEX[s]].label}</MenuItem>;
      })}
    </Menu>
  );
}

function CardBody({ o, lifted }: { o: Opportunity; lifted?: boolean }) {
  const db = useDb();
  const c = db.companies[o.companyId];
  const due = o.followUp && o.stage !== 'closed' && o.stage !== 'outcome' ? o.followUp : undefined;
  const overdue = !!due && dueLabel(due).days < 0;
  const reviewsPending = Object.values(db.reviews).filter((r) => r.opportunityId === o.id && (r.status === 'pending' || r.status === 'changes-requested')).length;
  const draftOpen = Object.values(db.drafts).some((d) => d.opportunityId === o.id && d.status === 'draft');
  const pathway = PATHWAY_META[TYPE_BY_ID[o.type].pathway];
  return (
    <div className={cn('relative cursor-grab overflow-hidden rounded-md border border-line bg-surface px-3 py-2.5 shadow-xs transition-[box-shadow,border-color] duration-fast hover:border-line-strong hover:shadow-sm active:cursor-grabbing', lifted && 'rotate-[1deg] shadow-lg ring-1 ring-accent/30')}>
      {overdue && <span className="absolute inset-y-0 left-0 w-[3px] bg-bad" aria-hidden />}
      <div className="flex items-center gap-1.5 pr-6 text-[11.5px] text-ink-3">
        <CompanyMark name={c?.name ?? '?'} size={16} />
        <span className="truncate">{c?.name}</span>
        <span className="ml-auto"><PriorityDot priority={o.priority} /></span>
      </div>
      <div className="mt-1 text-[13px] font-medium leading-snug text-ink">{o.title}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <span className={cn('h-1.5 w-1.5 rounded-full', { accent: 'bg-accent', talent: 'bg-talent', brand: 'bg-brand' }[pathway.tone as 'accent' | 'talent' | 'brand'])} aria-hidden />
        {TYPE_BY_ID[o.type].label}
      </div>
      {(reviewsPending > 0 || draftOpen) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {reviewsPending > 0 && <Badge tone="warn">{reviewsPending} in review</Badge>}
          {draftOpen && <Badge tone="outline">Draft · not sent</Badge>}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-line/70 pt-2">
        {o.facultyIds.length > 0 ? <AvatarStack names={o.facultyIds.map((f) => db.faculty[f]?.name ?? '?')} size={18} /> : <span className="text-[11px] text-ink-3">No researchers yet</span>}
        <span className="ml-auto flex items-center gap-2">
          {due ? <DueBadge iso={due} /> : <span className="meta">{daysSince(o.stageEnteredAt)}d in stage</span>}
          <Avatar name={db.users[o.ownerId]?.name ?? '?'} size={18} title={`Owner: ${db.users[o.ownerId]?.name}`} />
        </span>
      </div>
    </div>
  );
}
