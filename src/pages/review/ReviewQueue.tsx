import { useMemo, useState, type ReactNode } from 'react';
import { requestForOpportunity } from '@shared/matching/requests';
import { canReview } from '@shared/roles';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertOctagon, ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileWarning, FlaskConical, GitCompare, GraduationCap, History, Inbox, MessageSquare,
  RotateCcw, ShieldAlert, ShieldCheck, Sparkles, UserCheck, XCircle, FileText, CircleDashed, CornerUpLeft,
} from 'lucide-react';
import { baselineProvider, runBaseline } from '@shared/matching/baseline';
import type { MatchResult } from '@shared/matching/types';
import type { ReviewItem, ReviewKind } from '@shared/types';
import { useDb, useMe } from '@/lib/store';
import { cn } from '@/lib/cn';
import { fmtDate, relTime } from '@/lib/format';
import { panelVariants } from '@/lib/motion';
import { assignReview, bulkApprove, commentReview, decideReview, guardDecision, isOutreachKind, reopenReview, toggleCheck } from '@/lib/actions';
import { Page } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, Checkbox, EmptyState, Select } from '@/components/ui/primitives';
import { Tip, ask } from '@/components/ui/overlays';
import { CompanyLink, FacultyLink, FreshnessBadge, PriorityDot, StageBadge, UserName } from '@/components/domain';
import { ConfidenceBreakdown, CoverageTable, EvidenceList, ScoreBreakdown, ScoreHeader, UnknownsAndConcerns } from '@/components/match/Explanation';
import { corpusOf } from '@/lib/corpus';

export const KIND_META: Record<ReviewKind, { label: string; icon: React.ReactNode; tone: 'accent' | 'warn' | 'bad' | 'neutral' | 'talent' | 'brand' }> = {
  match: { label: 'Match recommendation', icon: <Sparkles />, tone: 'accent' },
  introduction: { label: 'Proposed introduction', icon: <FileText />, tone: 'accent' },
  'low-confidence': { label: 'Low-confidence match', icon: <ShieldAlert />, tone: 'warn' },
  'faculty-verification': { label: 'Faculty verification', icon: <UserCheck />, tone: 'neutral' },
  'company-info': { label: 'Company information', icon: <Building2 />, tone: 'neutral' },
  'data-conflict': { label: 'Data conflict', icon: <GitCompare />, tone: 'bad' },
  'incomplete-opportunity': { label: 'Incomplete opportunity', icon: <FileWarning />, tone: 'warn' },
  'ip-review': { label: 'IP review (OTT)', icon: <FlaskConical />, tone: 'brand' },
};

const STATUS_TONE = { pending: 'warn', approved: 'good', rejected: 'bad', 'changes-requested': 'accent' } as const;
const STATUS_LABEL = { pending: 'Awaiting review', approved: 'Approved', rejected: 'Rejected', 'changes-requested': 'Changes requested' } as const;

type Filter = 'awaiting' | 'mine' | 'changes' | 'approved' | 'rejected' | 'completed';

/** Approved outreach reviews whose introduction a person has since recorded as sent. */
function isCompleted(r: ReviewItem, drafts: ReturnType<typeof useDb>['drafts']) {
  return r.status === 'approved' && Object.values(drafts).some((d) => d.reviewId === r.id && d.status === 'recorded-sent');
}

/** The score quoted when the review was requested. Older records only carry it in the summary text. */
export function recordedScore(r: ReviewItem): number | undefined {
  if (typeof r.scoreAtRequest === 'number') return r.scoreAtRequest;
  const m = r.summary.match(/\((\d{1,3})\)/);
  return m ? Number(m[1]) : undefined;
}

export function ReviewQueue() {
  const db = useDb();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('awaiting');
  const [kind, setKind] = useState<ReviewKind | ''>('');
  const [checked, setChecked] = useState<string[]>([]);

  const all = Object.values(db.reviews);
  const isOpen = (r: ReviewItem) => r.status === 'pending' || r.status === 'changes-requested';
  const counts: Record<Filter, number> = {
    awaiting: all.filter(isOpen).length,
    mine: all.filter((r) => isOpen(r) && r.assigneeId === me.id).length,
    changes: all.filter((r) => r.status === 'changes-requested').length,
    approved: all.filter((r) => r.status === 'approved' && !isCompleted(r, db.drafts)).length,
    rejected: all.filter((r) => r.status === 'rejected').length,
    completed: all.filter((r) => isCompleted(r, db.drafts)).length,
  };
  const decidedView = filter === 'approved' || filter === 'rejected' || filter === 'completed';

  const items = useMemo(() => all
    .filter((r) => ({
      awaiting: isOpen(r), mine: isOpen(r) && r.assigneeId === me.id, changes: r.status === 'changes-requested',
      approved: r.status === 'approved' && !isCompleted(r, db.drafts), rejected: r.status === 'rejected', completed: isCompleted(r, db.drafts),
    })[filter])
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => decidedView ? (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '') : (({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]) || a.createdAt.localeCompare(b.createdAt)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [all, filter, kind, me.id, db.drafts]);

  const selectedId = params.get('item') ?? items[0]?.id;
  const selected = selectedId ? db.reviews[selectedId] : undefined;
  const select = (id: string) => setParams({ item: id }, { replace: true });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'awaiting', label: 'Awaiting' }, { id: 'mine', label: 'Mine' }, { id: 'changes', label: 'Changes requested' },
    { id: 'approved', label: 'Approved' }, { id: 'completed', label: 'Completed' }, { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <Page wide className="!pb-0">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink">Review Queue</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Every recommendation passes a person. Approval allows an introduction to be <em>drafted</em> — it never sends anything.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          Reviewing as <span className="inline-flex items-center gap-1.5 font-medium text-ink"><Avatar name={me.name} size={18} />{me.name}</span>
          {!canReview(me) && <Badge tone="outline">View only — reviewer role required to decide</Badge>}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Region 1 — queue */}
        <div className="panel flex flex-col overflow-hidden max-xl:max-h-[420px] xl:sticky xl:top-4 xl:h-[calc(100dvh-180px)]">
          <div className="border-b border-line p-2">
            <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-0.5">
              {FILTERS.map((f) => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setChecked([]); }}
                  className={cn('flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium transition-colors duration-fast', filter === f.id ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-subtle hover:text-ink')}>
                  {f.label}<span className={cn('font-mono text-[10.5px] tabular', filter === f.id ? 'text-accent' : 'text-ink-4')}>{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <Select className="mt-2 h-7 text-[12.5px]" value={kind} onChange={setKind} placeholder="All review types" options={Object.entries(KIND_META).map(([k, v]) => ({ value: k as ReviewKind, label: v.label }))} aria-label="Filter by type" />
          </div>
          {checked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft/60 px-3 py-2">
              <span className="text-xs font-medium text-ink-2">{checked.length} selected</span>
              <Button size="xs" onClick={async () => { const u = await ask({ title: `Assign ${checked.length} items`, confirmLabel: 'Assign', input: { label: 'Reviewer', required: true, options: Object.values(db.users).filter((u) => canReview(u)).map((u) => ({ value: u.id, label: u.name })) } }); if (u) { await assignReview(checked, u); setChecked([]); } }}>Assign…</Button>
              <Tip content="Only data-quality items with completed checklists. Outreach decisions are always reviewed one at a time.">
                <span><Button size="xs" onClick={async () => { await bulkApprove(checked); setChecked([]); }}>Approve data items</Button></span>
              </Tip>
              <button className="ml-auto text-xs text-ink-3 hover:text-ink" onClick={() => setChecked([])}>Clear</button>
            </div>
          )}
          <ul className="flex-1 overflow-y-auto scroll-thin divide-y divide-line" tabIndex={0} aria-label="Review items">
            {items.length === 0 && <EmptyState compact icon={<Inbox />} title={decidedView ? 'Nothing here yet' : 'Nothing waiting'}>{filter === 'mine' ? 'Nothing is assigned to you.' : filter === 'completed' ? 'Approved introductions appear here once staff record that they were sent.' : 'Items appear when matches are sent to review or data issues are flagged.'}</EmptyState>}
            {items.map((r) => {
              const meta = KIND_META[r.kind];
              const active = r.id === selectedId;
              const done = r.checklist.filter((c) => c.checked).length;
              return (
                <li key={r.id} className={cn('relative flex cursor-pointer gap-2.5 px-3 py-2.5 transition-colors duration-fast', active ? 'bg-accent-soft/55' : 'hover:bg-subtle/60')} onClick={() => select(r.id)}>
                  {active && <motion.span layoutId="review-active" className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
                  {!decidedView && <span onClick={(e) => e.stopPropagation()} className="pt-0.5"><Checkbox ariaLabel={`Select ${r.title}`} checked={checked.includes(r.id)} onChange={(v) => setChecked(v ? [...checked, r.id] : checked.filter((x) => x !== r.id))} /></span>}
                  <button className="min-w-0 flex-1 text-left outline-none" aria-current={active ? 'true' : undefined} onClick={() => select(r.id)}>
                    <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3 [&>svg]:h-3 [&>svg]:w-3">{meta.icon}<span className="truncate">{meta.label}</span><span className="meta ml-auto shrink-0">{relTime(decidedView ? r.decidedAt : r.createdAt)}</span></span>
                    <span className="mt-0.5 block text-[13px] font-medium leading-snug text-ink">{r.title}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <PriorityDot priority={r.priority} withLabel />
                      {r.status === 'changes-requested' && <Badge tone="accent" icon={<CornerUpLeft />}>Returned</Badge>}
                      {!decidedView && r.checklist.length > 0 && (
                        <Tip content={`${done} of ${r.checklist.length} checklist items confirmed`}>
                          <span className="flex items-center gap-1">
                            <span className="flex gap-[2px]">{r.checklist.map((c) => <span key={c.key} className={cn('h-1.5 w-2.5 rounded-[1px]', c.checked ? 'bg-good' : 'bg-line-strong/70')} />)}</span>
                          </span>
                        </Tip>
                      )}
                      {decidedView && <Badge tone={STATUS_TONE[r.status]}>{isCompleted(r, db.drafts) ? 'Intro recorded' : STATUS_LABEL[r.status]}</Badge>}
                      {r.assigneeId && <span className="ml-auto"><Avatar name={db.users[r.assigneeId]?.name ?? '?'} size={18} title={`Reviewer: ${db.users[r.assigneeId]?.name}`} /></span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Regions 2 + 3 — evidence and decision */}
        <div className="min-w-0 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div key={selected.id} variants={panelVariants} initial="initial" animate="enter" exit="exit">
                <ReviewDetail r={selected} />
              </motion.div>
            ) : <div className="panel"><EmptyState icon={<ClipboardCheck />} title="Select an item">Choose a review from the queue.</EmptyState></div>}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}

function ReviewDetail({ r }: { r: ReviewItem }) {
  const db = useDb();
  const me = useMe();
  const [comment, setComment] = useState('');
  const meta = KIND_META[r.kind];
  const opp = r.opportunityId ? db.opportunities[r.opportunityId] : undefined;
  const f = r.facultyId ? db.faculty[r.facultyId] : undefined;
  const company = r.companyId ? db.companies[r.companyId] : undefined;
  const decided = r.status === 'approved' || r.status === 'rejected';
  const outreach = isOutreachKind(r.kind);
  const reviewer = canReview(me);

  // Recompute with the baseline matcher against current records so the reviewer sees today's evidence.
  const match: MatchResult | undefined = useMemo(() => {
    if (!f || !opp) return undefined;
    const request = requestForOpportunity(db, opp);
    const res = runBaseline(request, { ...corpusOf(db), faculty: [f] });
    return res.results[0];
  }, [db, f, opp]);
  const historic = recordedScore(r);

  const approveGuard = guardDecision(r, 'approved');
  const decide = async (d: 'approved' | 'rejected' | 'changes-requested') => {
    let note: string | undefined = comment.trim() || undefined;
    if (d !== 'approved' && !note) {
      const v = await ask({ title: d === 'rejected' ? 'Reject this item?' : 'Request changes', confirmLabel: d === 'rejected' ? 'Reject' : 'Request changes', tone: d === 'rejected' ? 'danger' : 'primary', input: { label: 'Comment (required)', multiline: true, required: true } });
      if (v === null) return;
      note = v;
    }
    if (d === 'approved' && outreach && r.createdBy === me.id) {
      const ok = await ask({ title: 'Approve your own request?', body: 'You created this review. A second reviewer is recommended for outreach decisions. You can switch user from the account menu.', confirmLabel: 'Approve anyway' });
      if (ok === null) return;
    }
    if (d === 'approved' && outreach) {
      const ok = await ask({ title: 'Approve for introduction?', body: <>This allows a staff member to <b>prepare</b> an introduction draft. Nothing is sent, and no one is contacted. Staff send introductions themselves and record them afterwards.</>, confirmLabel: 'Approve' });
      if (ok === null) return;
    }
    if (await decideReview(r.id, d, note)) setComment('');
  };
  const done = r.checklist.filter((c) => c.checked).length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Region 2 — the recommendation and its evidence */}
      <div className="min-w-0 space-y-4">
        <section className="panel">
          <div className="px-5 pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
              <Badge tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Badge>
              <PriorityDot priority={r.priority} withLabel />
              <span className="meta ml-auto">Requested by <UserName id={r.createdBy} /> · {fmtDate(r.createdAt, 'MMM d')}</span>
            </div>
            <h2 className="mt-2 text-[19px] font-semibold leading-6 tracking-[-0.015em] text-ink">{r.title}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{historic !== undefined ? r.summary.replace(`(${historic})`, `(${historic} when requested)`) : r.summary}</p>
            <div className="mt-3 flex gap-2.5 border-l-2 border-warn pl-3 text-[13px] leading-snug text-ink-2">
              <AlertOctagon className="mt-px h-4 w-4 shrink-0 text-warn" />
              <span><b className="font-semibold text-ink">Why a person must look:</b> {r.reason}</span>
            </div>
          </div>
          {(f || company || opp || r.ipId) && (
            <dl className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {f && <Subject icon={<GraduationCap />} label="Researcher" title={<FacultyLink id={f.id} />} sub={<span className="flex flex-wrap items-center gap-1.5"><span>{db.departments[f.departmentId]?.name}</span><FreshnessBadge iso={f.lastVerified} compact /><Badge tone={f.emailVerified ? 'good' : 'warn'}>{f.emailVerified ? 'Contact verified' : 'Contact unverified'}</Badge></span>} />}
              {company && <Subject icon={<Building2 />} label="Company" title={<CompanyLink id={company.id} />} sub={<span>{company.industry} · <span className="capitalize">{company.relationship}</span></span>} />}
              {opp && <Subject icon={<FileText />} label="Opportunity" title={<Link className="hover:text-accent hover:underline underline-offset-2" to={`/opportunities/${opp.id}`}>{opp.title}</Link>} sub={<StageBadge stage={opp.stage} />} />}
              {r.ipId && db.ip[r.ipId] && <Subject icon={<FlaskConical />} label="Technology" title={<Link className="hover:text-accent" to={`/ip?item=${r.ipId}`}>{db.ip[r.ipId].title}</Link>} sub={`${db.ip[r.ipId].status.replace('-', ' ')} · licensing ${db.ip[r.ipId].licensing}${db.ip[r.ipId].verified ? '' : ' (unverified by OTT)'}`} />}
            </dl>
          )}
        </section>

        {match && historic !== undefined && historic !== match.score && <ScoreHistory r={r} historic={historic} current={match.score} />}

        {match && (
          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Evidence behind the recommendation</span>
              <span className="meta hidden sm:inline">Recomputed {fmtDate(new Date().toISOString(), 'MMM d')} · <span className="mono">{baselineProvider.id} v{baselineProvider.version}</span></span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-5 2xl:grid-cols-2">
              <div className="space-y-5"><ScoreHeader r={match} /><ScoreBreakdown r={match} /></div>
              <div className="space-y-5">
                <div><div className="eyebrow mb-2">Topic coverage</div><CoverageTable r={match} /></div>
                <div><div className="eyebrow mb-2">Supporting records</div><EvidenceList items={match.evidence} facultyId={match.facultyId} limit={4} /></div>
              </div>
              <div className="grid grid-cols-1 gap-5 2xl:col-span-2 2xl:grid-cols-2"><UnknownsAndConcerns r={match} /><ConfidenceBreakdown r={match} /></div>
            </div>
          </section>
        )}

        {r.dataIssueId && db.issues[r.dataIssueId]?.values && (
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Conflicting values</span><span className="meta">{db.issues[r.dataIssueId].field}</span></div>
            <div className="divide-y divide-line">
              {db.issues[r.dataIssueId].values!.map((v) => <div key={v.sourceId} className="flex justify-between gap-4 px-4 py-2.5 text-sm"><span className="font-medium">{v.value}</span><span className="meta">{db.sources[v.sourceId]?.name}</span></div>)}
            </div>
          </section>
        )}

        <section className="panel">
          <div className="panel-head"><span className="panel-title flex items-center gap-2"><History className="h-3.5 w-3.5 text-ink-3" />Discussion & history</span><span className="meta">{r.history.length} events</span></div>
          <ol className="space-y-3 px-5 py-4">
            {r.history.map((h, i) => (
              <li key={i} className="flex gap-2.5">
                <Avatar name={db.users[h.by]?.name ?? '?'} size={22} />
                <div className="min-w-0 text-sm">
                  <div><span className="font-medium text-ink">{db.users[h.by]?.name}</span> <span className="text-ink-3">{{ created: 'requested review', commented: 'commented', approved: 'approved', rejected: 'rejected', 'changes-requested': 'requested changes', reopened: 'reopened', checked: 'updated checklist', assigned: 'assigned to' }[h.action]}</span> <span className="meta">· {fmtDate(h.at, 'MMM d, h:mm a')}</span></div>
                  {h.note && <p className="mt-1 border-l-2 border-line-strong pl-2.5 text-ink-2">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 border-t border-line px-4 py-3">
            <input className="input" placeholder="Add a comment for the team…" aria-label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) { commentReview(r.id, comment.trim()); setComment(''); } }} />
            <Button icon={<MessageSquare className="h-4 w-4" />} disabled={!comment.trim()} onClick={() => { commentReview(r.id, comment.trim()); setComment(''); }}>Post</Button>
          </div>
        </section>
      </div>

      {/* Region 3 — checklist and decision, kept in view */}
      <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Reviewer decision">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Reviewer</span>
              {reviewer ? (
                <select className="max-w-[60%] truncate rounded border-0 bg-transparent text-right text-[12.5px] font-medium text-ink hover:bg-subtle focus:outline-none" aria-label="Assigned reviewer" value={r.assigneeId ?? ''} onChange={(e) => e.target.value && assignReview([r.id], e.target.value)}>
                  <option value="">Unassigned</option>
                  {Object.values(db.users).filter((u) => canReview(u)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : <span className="text-[12.5px] font-medium"><UserName id={r.assigneeId} /></span>}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Checklist</span>
              <span className={cn('font-mono text-[11.5px] tabular', done === r.checklist.length ? 'text-good' : 'text-ink-3')}>{done}/{r.checklist.length}</span>
            </div>
            <div className="mt-1.5 flex gap-[3px]">{r.checklist.map((c) => <motion.span key={c.key} layout className={cn('h-1 flex-1 rounded-full', c.checked ? 'bg-good' : 'bg-line')} />)}</div>
            <div className="mt-3 space-y-2.5">
              {r.checklist.map((c) => <Checkbox key={c.key} checked={c.checked} disabled={decided || !reviewer} onChange={() => toggleCheck(r.id, c.key)} label={<span className="text-[13px]">{c.label}</span>} description={c.hint} />)}
            </div>
            {r.missing.length > 0 && (
              <div className="mt-4 border-t border-dashed border-line pt-3">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2"><CircleDashed className="h-3.5 w-3.5 text-warn" />Still to confirm</div>
                <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">{r.missing.map((m) => <li key={m} className="flex gap-2"><span className="text-ink-4">—</span>{m}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-line bg-canvas/60 px-4 py-3 max-lg:sticky max-lg:bottom-0">
            {decided ? (
              <>
                <div className="flex items-start gap-2 text-[13px]">
                  {r.status === 'approved' ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-good" /> : <XCircle className="mt-px h-4 w-4 shrink-0 text-bad" />}
                  <span><b className="font-semibold">{STATUS_LABEL[r.status]}</b> by <UserName id={r.decidedBy ?? r.history.filter((h) => h.action === r.status).pop()?.by} /><span className="block meta">{fmtDate(r.decidedAt, 'MMM d, yyyy · h:mm a')}</span></span>
                </div>
                {r.status === 'approved' && opp && outreach && <Link to={`/opportunities/${opp.id}#intro`} className="block"><Button variant="primary" className="w-full justify-center" icon={<FileText className="h-4 w-4" />}>Prepare introduction draft</Button></Link>}
                {r.status === 'approved' && outreach && <p className="text-[11.5px] leading-4 text-ink-3">Drafting doesn’t send. Staff send it themselves, then record it.</p>}
                <Button variant="ghost" className="w-full justify-center" icon={<RotateCcw className="h-4 w-4" />} onClick={() => reopenReview(r.id)} disabled={!reviewer}>Reopen</Button>
              </>
            ) : (
              <>
                <Tip content={!approveGuard.ok ? approveGuard.reason : outreach ? 'Allows an introduction to be drafted. Nothing is sent.' : undefined}>
                  <span className="block"><Button variant="primary" className="w-full justify-center" icon={<CheckCircle2 className="h-4 w-4" />} disabled={!approveGuard.ok} onClick={() => decide('approved')}>Approve{outreach ? ' for introduction' : ''}</Button></span>
                </Tip>
                {!approveGuard.ok && reviewer && <p className="text-[11.5px] leading-4 text-ink-3">{approveGuard.reason}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => decide('changes-requested')} disabled={!reviewer} className="justify-center">Request changes</Button>
                  <Button variant="danger" onClick={() => decide('rejected')} disabled={!reviewer} className="justify-center">Reject</Button>
                </div>
                <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-4 text-ink-3"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-good" />Approving never contacts the researcher or the company.</p>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Historical vs. recomputed score: both shown, each with when and how it was produced. */
function ScoreHistory({ r, historic, current }: { r: ReviewItem; historic: number; current: number }) {
  const delta = current - historic;
  return (
    <section className="panel overflow-hidden" aria-label="Score history">
      <div className="flex items-center gap-2 border-b border-line bg-info-soft/50 px-4 py-2">
        <History className="h-3.5 w-3.5 text-info" />
        <span className="text-[13px] font-semibold text-ink">This score has changed since the review was requested</span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-[1fr_auto_1fr] sm:divide-y-0">
        <div className="px-4 py-3">
          <div className="eyebrow">When requested</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="figure text-[24px] text-ink-3 line-through decoration-ink-4/50 decoration-1">{historic}</span><span className="text-xs text-ink-3">historical</span></div>
          <div className="meta mt-0.5">{fmtDate(r.createdAt, 'MMM d, yyyy')} · quoted by <UserName id={r.createdBy} /></div>
        </div>
        <div className="hidden items-center px-2 sm:flex"><span className={cn('flex items-center gap-1 rounded-sm px-1.5 font-mono text-[12px] tabular', delta < 0 ? 'bg-warn-soft text-warn' : 'bg-good-soft text-good')}><ArrowRight className="h-3 w-3" />{delta > 0 ? '+' : ''}{delta}</span></div>
        <div className="px-4 py-3">
          <div className="eyebrow">Recomputed now</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="figure text-[24px]">{current}</span><span className="text-xs text-ink-3">current evidence</span></div>
          <div className="meta mt-0.5">{fmtDate(new Date().toISOString(), 'MMM d, yyyy')} · <span className="mono">{baselineProvider.id} v{baselineProvider.version}</span></div>
        </div>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[12.5px] leading-snug text-ink-2">
        Scores are recomputed from today’s records. A difference usually means evidence changed — a project ended, a record was re-verified — or the matcher was updated.
        <b className="font-medium text-ink"> Decide on the current evidence below.</b> The original figure stays in the record for the audit trail.
      </p>
    </section>
  );
}

function Subject({ icon, label, title, sub }: { icon: ReactNode; label: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="flex items-center gap-1.5 eyebrow [&>svg]:h-3 [&>svg]:w-3">{icon}{label}</dt>
      <dd className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">{title}</dd>
      {sub && <dd className="mt-1 text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}
