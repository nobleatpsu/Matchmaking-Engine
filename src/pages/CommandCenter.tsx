import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import {
  AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, FileText, Plus, Radar, RefreshCcw, Sparkles, TrendingUp, DatabaseZap,
} from 'lucide-react';
import { freshness, STAGES } from '@shared/rules';
import type { ReactNode } from 'react';
import { useDb, useMe, useStore } from '@/lib/store';
import { Onboarding } from './Onboarding';
import { useUI } from '@/lib/ui';
import { cn } from '@/lib/cn';
import { daysSince, dueLabel, greeting, plural, relTime } from '@/lib/format';
import { itemVariants, listVariants, t } from '@/lib/motion';
import { toggleTask } from '@/lib/actions';
import { Page } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Checkbox } from '@/components/ui/primitives';
import { Tip } from '@/components/ui/overlays';
import { ActivityFeed, CompanyMark, DueBadge, PriorityDot, StageBadge } from '@/components/domain';

type Urgency = 'overdue' | 'decision' | 'draft' | 'soon';
type QueueItem = { id: string; urgency: Urgency; rank: number; title: string; context: ReactNode; href: string; due?: string; ownerId?: string; cta: string; why: string; taskId?: string };

export function CommandCenter() {
  const db = useDb();
  const workspace = useStore((s) => s.workspace);
  if (workspace === 'live' && (Object.keys(db.faculty).length === 0 || Object.keys(db.companies).length === 0)) return <Onboarding />;
  return <Dashboard />;
}

const GROUPS: { id: Urgency; label: string; hint: string }[] = [
  { id: 'overdue', label: 'Overdue', hint: 'Past their follow-up date' },
  { id: 'decision', label: 'Decisions waiting on you', hint: 'Reviews assigned to you or returned to you' },
  { id: 'draft', label: 'Prepared, not sent', hint: 'Introduction drafts you still need to send yourself and record' },
  { id: 'soon', label: 'Due in the next two days', hint: 'Follow-ups coming up' },
];

function Dashboard() {
  const db = useDb();
  const me = useMe();
  const navigate = useNavigate();
  const openNewOpp = useUI((s) => s.openNewOpp);

  const openReviews = Object.values(db.reviews).filter((r) => r.status === 'pending' || r.status === 'changes-requested');
  const myReviews = openReviews.filter((r) => r.assigneeId === me.id);
  const myTasks = Object.values(db.tasks).filter((t) => t.ownerId === me.id && !t.done);
  const overdueTasks = myTasks.filter((t) => dueLabel(t.due).days < 0);
  const newSignals = Object.values(db.signals).filter((s) => s.status === 'new');
  const staleFaculty = Object.values(db.faculty).filter((f) => freshness(f.lastVerified) === 'stale');
  const openIssues = Object.values(db.issues).filter((i) => i.status === 'open');
  const myOpps = Object.values(db.opportunities).filter((o) => o.ownerId === me.id && o.stage !== 'closed');
  const unsentDrafts = Object.values(db.drafts).filter((d) => d.status === 'draft' && db.opportunities[d.opportunityId]?.ownerId === me.id);
  const company = (id?: string) => (id ? db.companies[id]?.name : undefined);

  // Everything that needs *this* person to act, grouped by why it is urgent.
  const queue: QueueItem[] = [
    ...myReviews.map((r) => ({
      id: r.id, urgency: 'decision' as const, rank: r.priority === 'high' ? 3 : 2, title: r.title, ownerId: r.createdBy,
      context: <>{company(r.companyId) ?? 'Data review'}{r.opportunityId && db.opportunities[r.opportunityId] ? <> · {db.opportunities[r.opportunityId].title}</> : null}</>,
      href: `/review?item=${r.id}`, cta: 'Review', why: r.reason,
    })),
    ...openReviews.filter((r) => r.createdBy === me.id && r.status === 'changes-requested').map((r) => ({
      id: `cr-${r.id}`, urgency: 'decision' as const, rank: 3, title: `Changes requested — ${r.title}`, ownerId: r.history.filter((h) => h.action === 'changes-requested').pop()?.by,
      context: r.history.filter((h) => h.action === 'changes-requested').pop()?.note ?? '', href: `/review?item=${r.id}`, cta: 'Respond', why: 'A reviewer returned your request',
    })),
    ...unsentDrafts.map((d) => ({
      id: d.id, urgency: 'draft' as const, rank: 2, title: `Introduction to ${db.faculty[d.facultyId]?.name}`, ownerId: d.createdBy,
      context: <>{company(db.opportunities[d.opportunityId]?.companyId)} · {db.opportunities[d.opportunityId]?.title}</>,
      href: `/opportunities/${d.opportunityId}#intro`, cta: 'Open draft', why: 'Send it yourself, then record it here',
    })),
    ...myTasks.filter((t) => dueLabel(t.due).days <= 2).map((t) => ({
      id: t.id, taskId: t.id, urgency: (dueLabel(t.due).days < 0 ? 'overdue' : 'soon') as Urgency, rank: -dueLabel(t.due).days, title: t.title, due: t.due, ownerId: t.ownerId,
      context: t.opportunityId ? <>{company(db.opportunities[t.opportunityId]?.companyId)} · {db.opportunities[t.opportunityId]?.title}</> : company(t.companyId) ?? 'General follow-up',
      href: t.opportunityId ? `/opportunities/${t.opportunityId}` : t.companyId ? `/companies/${t.companyId}` : '/opportunities', cta: 'Open', why: 'Follow-up',
    })),
  ];
  const grouped = GROUPS.map((g) => ({ ...g, items: queue.filter((q) => q.urgency === g.id).sort((a, b) => b.rank - a.rank) })).filter((g) => g.items.length);

  const later = [...myTasks].filter((tk) => dueLabel(tk.due).days > 2).sort((a, b) => a.due.localeCompare(b.due));
  const progressed = Object.values(db.activities).filter((a) => a.kind === 'stage-change' || a.kind === 'intro-recorded' || a.kind === 'outcome').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const signalsFor = (companyId: string) => Object.values(db.signals).filter((s) => s.companyIds.includes(companyId) && s.status !== 'dismissed' && daysSince(s.date) < 30);
  const revisit = Object.values(db.companies).filter((c) => (c.relationship === 'dormant' || c.relationship === 'former') && signalsFor(c.id).length > 0);

  const stageCounts = STAGES.filter((s) => s.id !== 'closed').map((s) => ({ ...s, n: Object.values(db.opportunities).filter((o) => o.stage === s.id).length }));
  const maxStage = Math.max(...stageCounts.map((s) => s.n), 1);
  const activeTotal = stageCounts.reduce((a, s) => a + s.n, 0);

  const ledger = [
    { label: 'Reviews waiting', value: openReviews.length, sub: `${myReviews.length} assigned to you`, href: '/review', icon: <ClipboardCheck />, alert: myReviews.length > 0 },
    { label: 'Overdue follow-ups', value: overdueTasks.length, sub: `of ${plural(myTasks.length, 'open task')}`, href: '/opportunities?overdue=1', icon: <CalendarClock />, alert: overdueTasks.length > 0, bad: true },
    { label: 'Drafts not sent', value: unsentDrafts.length, sub: 'Sent by you, outside the system', href: '/opportunities', icon: <FileText />, alert: false },
    { label: 'New signals', value: newSignals.length, sub: 'Awaiting triage', href: '/signals', icon: <Radar />, alert: false },
    { label: 'Stale researcher records', value: staleFaculty.length, sub: `${openIssues.length} open data issues`, href: '/data?tab=issues', icon: <DatabaseZap />, alert: false },
  ];

  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-ink-3">{format(new Date(), 'EEEE, MMMM d')}</div>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink">{greeting()}, {me.name.split(' ')[0]}.</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {queue.length
              ? <><b className="font-semibold text-ink">{plural(queue.length, 'item')}</b> need you{overdueTasks.length ? <>, <b className="font-semibold text-bad">{overdueTasks.length} overdue</b></> : null}. You own {plural(myOpps.length, 'active opportunity', 'active opportunities')}.</>
              : 'Nothing is waiting on you. A good moment to triage signals or verify researcher records.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => openNewOpp()}>New opportunity</Button>
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={() => navigate('/match')}>Match a company need</Button>
        </div>
      </div>

      {/* Ledger: one ruled strip, not five cards. Every figure links to the records behind it. */}
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 lg:grid-cols-5">
        {ledger.map((m) => (
          <Link key={m.label} to={m.href} className="group relative -ml-px -mt-px flex flex-col gap-0.5 border-l border-t border-line px-4 py-3 transition-colors duration-fast hover:bg-subtle/60">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3 [&>svg]:h-3.5 [&>svg]:w-3.5">{m.icon}{m.label}</span>
            <span className={cn('figure text-[26px] leading-8', m.alert && m.bad ? 'text-bad' : m.alert ? 'text-accent' : '')}>{m.value}</span>
            <span className="truncate text-[12px] text-ink-3">{m.sub}</span>
            <ArrowRight className="absolute right-3 top-3.5 h-3.5 w-3.5 text-ink-4 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="attention">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="attention" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Needs your attention</h2>
              <span className="text-xs text-ink-3">Sorted by why it is urgent</span>
            </div>
            <div className="panel overflow-hidden">
              {grouped.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-3">You’re clear. Nothing is waiting on you.</p>}
              {grouped.map((g, gi) => (
                <div key={g.id} className={cn(gi > 0 && 'border-t border-line')}>
                  <div className="flex items-center gap-2 bg-canvas/60 px-4 py-1.5">
                    <UrgencyGlyph u={g.id} />
                    <span className="text-[12px] font-semibold text-ink-2">{g.label}</span>
                    <span className="meta">{g.items.length}</span>
                    <span className="ml-auto hidden text-[11.5px] text-ink-3 sm:block">{g.hint}</span>
                  </div>
                  <motion.ul variants={listVariants} initial="initial" animate="enter" className="divide-y divide-line">
                    {g.items.map((q) => (
                      <motion.li key={q.id} variants={itemVariants} className="group grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 row-hover sm:grid-cols-[20px_minmax(0,1fr)_96px_28px_auto]">
                        <span className="flex justify-center">{q.taskId ? <Tip content="Mark done"><span><Checkbox ariaLabel={`Mark done: ${q.title}`} checked={false} onChange={() => toggleTask(q.taskId!)} /></span></Tip> : <UrgencyGlyph u={q.urgency} hollow />}</span>
                        <Link to={q.href} className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium text-ink group-hover:text-accent">{q.title}</div>
                          <div className="truncate text-[12.5px] text-ink-3">{q.context}</div>
                        </Link>
                        <span className="hidden text-right sm:block">{q.due ? <DueBadge iso={q.due} /> : null}</span>
                        <span className="hidden sm:block">{q.ownerId && q.ownerId !== me.id && db.users[q.ownerId] && <Tip content={`${q.urgency === 'decision' ? 'Requested by' : 'Owner'}: ${db.users[q.ownerId].name}`}><span><Avatar name={db.users[q.ownerId].name} size={22} /></span></Tip>}</span>
                        <Link to={q.href} tabIndex={-1}><Button size="sm" variant={q.urgency === 'decision' ? 'primary' : 'secondary'} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>{q.cta}</Button></Link>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="pipeline-glance">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="pipeline-glance" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Pipeline</h2>
              <Link to="/opportunities" className="text-xs font-medium text-accent hover:underline">Open pipeline</Link>
            </div>
            <div className="panel overflow-hidden">
              <div className="border-b border-line px-4 pb-3 pt-3.5">
                <div className="mb-2 flex items-baseline justify-between text-[12px] text-ink-3"><span>Whole team · {activeTotal} active by stage</span><span className="hidden sm:inline">A person records every introduction — none are sent by the system</span></div>
                <div className="grid grid-cols-8 gap-1" role="list" aria-label="Opportunities by stage">
                  {stageCounts.map((s) => (
                    <Tip key={s.id} content={`${s.label}: ${s.n}`}>
                      <Link to="/opportunities" role="listitem" aria-label={`${s.label}: ${s.n}`} className="group flex flex-col gap-1.5">
                        <span className="flex h-10 items-end"><motion.span className={cn('w-full rounded-[2px] origin-bottom', s.id === 'outcome' ? 'bg-good/70 group-hover:bg-good' : 'bg-viz-3/60 group-hover:bg-viz-2')} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={t.data} style={{ height: `${Math.max(6, (s.n / maxStage) * 100)}%` }} /></span>
                        <span className="figure text-[15px] leading-none">{s.n}</span>
                        <span className="truncate text-[11px] leading-tight text-ink-3">{s.short}</span>
                      </Link>
                    </Tip>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pt-3 pb-1"><span className="text-[12px] font-semibold text-ink-2">Yours</span><span className="meta">{myOpps.length}</span></div>
              <table className="w-full text-sm">
                <caption className="sr-only">Your active opportunities</caption>
                <tbody className="divide-y divide-line">
                  {[...myOpps].sort((a, b) => (a.followUp ?? '9').localeCompare(b.followUp ?? '9')).slice(0, 6).map((o) => (
                    <tr key={o.id} className="row-hover cursor-pointer" onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td className="py-2 pl-4 pr-2"><div className="flex items-center gap-2.5"><CompanyMark name={db.companies[o.companyId]?.name ?? '?'} size={22} /><div className="min-w-0"><Link to={`/opportunities/${o.id}`} className="block truncate font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>{o.title}</Link><div className="truncate text-xs text-ink-3">{o.nextAction ?? db.companies[o.companyId]?.name}</div></div></div></td>
                      <td className="hidden px-2 md:table-cell"><StageBadge stage={o.stage} /></td>
                      <td className="px-2"><PriorityDot priority={o.priority} /></td>
                      <td className="pl-2 pr-4 text-right"><DueBadge iso={o.stage === 'outcome' ? undefined : o.followUp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="moved">
            <h2 id="moved" className="mb-2 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink"><TrendingUp className="h-4 w-4 text-good" />Recently moved forward</h2>
            <ol className="panel divide-y divide-line">
              {progressed.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <Avatar name={db.users[a.actorId]?.name ?? '?'} size={20} />
                  <span className="min-w-0 flex-1 truncate">{a.opportunityId && <Link to={`/opportunities/${a.opportunityId}`} className="font-medium text-ink hover:text-accent">{db.opportunities[a.opportunityId]?.title}</Link>} <span className="text-ink-3">— {a.text}</span></span>
                  <span className="meta shrink-0">{relTime(a.at)}</span>
                </li>
              ))}
              {progressed.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">No stage changes recorded yet.</li>}
            </ol>
          </section>
        </div>

        <aside className="space-y-6" aria-label="Your week and relationship signals">
          {later.length > 0 && <section aria-labelledby="week">
            <div className="mb-2 flex items-baseline justify-between"><h2 id="week" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Later follow-ups</h2><span className="meta">{later.length} of {myTasks.length} open</span></div>
            <ul className="panel divide-y divide-line">
              {later.slice(0, 6).map((tk) => (
                <li key={tk.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                  <Checkbox ariaLabel={`Mark done: ${tk.title}`} checked={tk.done} onChange={() => toggleTask(tk.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-snug text-ink">{tk.title}</div>
                    <div className="mt-0.5 flex items-center gap-2"><DueBadge iso={tk.due} />{tk.companyId && <span className="truncate text-xs text-ink-3">{db.companies[tk.companyId]?.name}</span>}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>}

          <section aria-labelledby="relationships">
            <h2 id="relationships" className="mb-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">Across your relationships</h2>
            <div className="panel divide-y divide-line">
              <SideBlock icon={<Radar />} title="Signals to triage" count={newSignals.length} href="/signals">
                {[...newSignals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((s) => (
                  <Link key={s.id} to={`/signals?item=${s.id}`} className="block rounded-md px-2 py-1.5 -mx-2 hover:bg-subtle/70"><div className="text-[13px] leading-snug text-ink">{s.title}</div><div className="meta mt-0.5">{s.source.label} · {relTime(s.date)}</div></Link>
                ))}
              </SideBlock>
              {revisit.length > 0 && (
                <SideBlock icon={<RefreshCcw />} title="Dormant relationships with new activity" count={revisit.length} href="/companies">
                  {revisit.slice(0, 3).map((c) => (
                    <Link key={c.id} to={`/companies/${c.id}`} className="-mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-subtle/70">
                      <CompanyMark name={c.name} size={20} />
                      <span className="min-w-0"><span className="block text-[13px] font-medium text-ink">{c.name} <span className="font-normal capitalize text-ink-3">· {c.relationship}</span></span><span className="block truncate text-xs text-ink-3">{signalsFor(c.id)[0]?.title}</span></span>
                    </Link>
                  ))}
                </SideBlock>
              )}
              <SideBlock icon={<AlertTriangle />} title="Data quality" count={openIssues.length} href="/data?tab=issues">
                {openIssues.slice(0, 3).map((i) => (
                  <Link key={i.id} to={i.entity === 'faculty' ? `/faculty/${i.entityId}?tab=data` : '/data?tab=issues'} className="-mx-2 block rounded-md px-2 py-1.5 hover:bg-subtle/70">
                    <div className="text-[13px] text-ink"><span className="font-medium capitalize">{i.kind.replace('-', ' ')}</span> · {i.entity === 'faculty' ? db.faculty[i.entityId]?.name : i.entity === 'ip' ? db.ip[i.entityId]?.title : db.companies[i.entityId]?.name}</div>
                    <div className="truncate text-xs text-ink-3">{i.detail}</div>
                  </Link>
                ))}
              </SideBlock>
            </div>
          </section>

          <section aria-labelledby="team">
            <h2 id="team" className="mb-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">Team activity</h2>
            <div className="panel p-4"><ActivityFeed items={Object.values(db.activities)} limit={6} /></div>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function SideBlock({ icon, title, count, href, children }: { icon: ReactNode; title: string; count: number; href: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-ink-3">
        {icon}<span className="text-[12px] font-semibold text-ink-2">{title}</span><span className="meta">{count}</span>
        <Link to={href} className="ml-auto text-[12px] font-medium text-accent hover:underline">All</Link>
      </div>
      {count === 0 ? <p className="text-[12.5px] text-ink-3">Nothing new.</p> : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function UrgencyGlyph({ u, hollow }: { u: Urgency; hollow?: boolean }) {
  const map = {
    overdue: 'bg-bad',
    decision: 'bg-accent',
    draft: 'bg-warn',
    soon: 'bg-ink-4',
  } as const;
  return <span className={cn('h-2 w-2 rounded-[2px]', hollow ? 'opacity-60' : '', map[u])} aria-hidden />;
}
