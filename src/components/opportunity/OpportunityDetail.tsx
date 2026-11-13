import { useEffect, useMemo, useState } from 'react';
import { requestForOpportunity } from '@shared/matching/requests';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Check, CheckCircle2, ClipboardCheck, Copy, FileText, Flag, MoreHorizontal, NotebookPen, Plus, Printer, Radar, Send,
  ShieldCheck, Sparkles, CalendarPlus, Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { OUTCOME_LABELS, STAGES, TYPE_BY_ID, canTransition, stageLabel } from '@shared/rules';
import { runBaseline } from '@shared/matching/baseline';
import type { IntroDraft, Opportunity, OutcomeKind, Stage } from '@shared/types';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { daysSince, fmtDate, money, relTime } from '@/lib/format';
import {
  addOpportunityNote, addTask, createDraft, logActivity, recordOutcome, recordSent, requestReview, saveDraft, toggleTask, updateOpportunity,
} from '@/lib/actions';
import { moveWithChecks } from '@/lib/moveFlow';
import { corpusOf } from '@/lib/corpus';
import { Button } from '../ui/Button';
import { Avatar, Badge, Checkbox, EmptyState, Select } from '../ui/primitives';
import { Menu, MenuItem, MenuLabel, MenuSep, Tip, ask } from '../ui/overlays';
import { ActivityFeed, CompanyMark, DueBadge, InfoNote, PriorityDot, StageBadge, TypeBadge, UserName } from '../domain';
import { FacultyPicker } from '../forms/Pickers';

export function StageStepper({ opp }: { opp: Opportunity }) {
  const db = useDb();
  const navigate = useNavigate();
  const stages: Stage[] = TYPE_BY_ID[opp.type].stages.filter((s) => s !== "closed");
  const idx = stages.indexOf(opp.stage);
  const closed = opp.stage === 'closed';
  return (
    <ol className="flex w-full overflow-x-auto scroll-thin rounded-lg bg-canvas p-1 ring-1 ring-line/70">
      {stages.map((s, i) => {
        const done = closed ? true : i < idx;
        const current = s === opp.stage;
        const g = canTransition(opp, s, db);
        return (
          <li key={s} className="flex-1 min-w-[96px]">
            <Tip content={current ? STAGES.find((x) => x.id === s)?.description : g.ok ? `Move to ${stageLabel(s)}` : g.reason}>
              <button
                onClick={() => !current && moveWithChecks(opp.id, s, navigate)}
                className={cn('flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors whitespace-nowrap',
                  current ? 'bg-surface text-accent shadow-sm ring-1 ring-accent-line' : done ? 'text-ink-2 hover:bg-surface' : 'text-ink-4 hover:bg-surface hover:text-ink-2')}
              >
                {done && !current ? <Check className="h-3.5 w-3.5 text-good" strokeWidth={3} /> : <span className={cn('h-1.5 w-1.5 rounded-full', current ? 'bg-accent' : 'bg-line-strong')} />}
                {STAGES.find((x) => x.id === s)?.short}
              </button>
            </Tip>
          </li>
        );
      })}
    </ol>
  );
}

export function OpportunityDetail({ id, compact }: { id: string; compact?: boolean }) {
  const db = useDb();
  const navigate = useNavigate();
  const opp = db.opportunities[id];
  if (!opp) return <EmptyState title="Opportunity not found" />;
  const company = db.companies[opp.companyId];
  const interest = opp.interestId ? db.interests[opp.interestId] : undefined;
  const type = TYPE_BY_ID[opp.type];
  const reviews = Object.values(db.reviews).filter((r) => r.opportunityId === opp.id);
  const drafts = Object.values(db.drafts).filter((d) => d.opportunityId === opp.id);
  const tasks = Object.values(db.tasks).filter((t) => t.opportunityId === opp.id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const activities = Object.values(db.activities).filter((a) => a.opportunityId === opp.id);
  const signals = opp.signalIds.map((s) => db.signals[s]).filter(Boolean);
  const search = opp.matchSearchId ? db.searches[opp.matchSearchId] : undefined;

  const matchFor = (fid: string) => {
    const f = db.faculty[fid];
    const request = requestForOpportunity(db, opp);
    return runBaseline(request, { ...corpusOf(db), faculty: [f] }).results[0];
  };

  const scheduleFollowUp = async () => {
    const title = await ask({ title: 'Schedule a follow-up', confirmLabel: 'Next: pick date', input: { label: 'What needs to happen?', required: true, initial: opp.nextAction } });
    if (!title) return;
    const date = await ask({ title: 'When?', confirmLabel: 'Schedule', input: { label: 'Due date (YYYY-MM-DD)', required: true, initial: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) } });
    if (!date || isNaN(Date.parse(date))) { if (date) toast.error('Use the format YYYY-MM-DD'); return; }
    const due = new Date(date + 'T12:00:00').toISOString();
    await addTask({ title, due, opportunityId: opp.id, companyId: opp.companyId });
    await updateOpportunity(opp.id, { followUp: due, nextAction: title });
  };
  const logIt = async (kind: 'meeting' | 'call' | 'email-logged' | 'note') => {
    const text = await ask({ title: { meeting: 'Log a meeting', call: 'Log a call', 'email-logged': 'Log an email', note: 'Add a note' }[kind], confirmLabel: 'Save', input: { label: 'What happened?', multiline: true, required: true } });
    if (!text) return;
    if (kind === 'note') addOpportunityNote(opp.id, text); else logActivity(kind, text, { opportunityId: opp.id, companyId: opp.companyId });
  };
  const addOutcome = async () => {
    const kind = await ask({ title: 'Record an outcome', body: 'What actually happened — separate from any match score.', confirmLabel: 'Next', input: { label: 'Outcome', required: true, options: Object.entries(OUTCOME_LABELS).map(([value, v]) => ({ value, label: v.label })) } });
    if (!kind) return;
    const fid = opp.facultyIds.length > 1 ? await ask({ title: 'Which researcher?', confirmLabel: 'Next', input: { label: 'Researcher', options: opp.facultyIds.map((f) => ({ value: f, label: db.faculty[f].name })) } }) : opp.facultyIds[0];
    const note = await ask({ title: 'Context (optional)', confirmLabel: 'Record outcome', input: { label: 'Note', multiline: true } });
    if (note === null) return;
    recordOutcome(opp.id, { kind: kind as OutcomeKind, note: note || undefined, facultyId: fid || undefined });
  };

  return (
    <div className={cn('space-y-5', compact && 'p-5')}>
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <CompanyMark name={company?.name ?? '?'} size={compact ? 36 : 44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <Link to={`/companies/${company?.id}`} className="font-medium text-ink-2 hover:text-accent">{company?.name}</Link>
            <TypeBadge type={opp.type} /><StageBadge stage={opp.stage} /><PriorityDot priority={opp.priority} withLabel />
          </div>
          {compact ? <h2 className="mt-1 text-xl font-semibold text-ink">{opp.title}</h2> : <h1 className="mt-1 font-serif text-[28px] leading-[34px] font-semibold tracking-[-0.015em] text-ink">{opp.title}</h1>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compact && <Link to={`/opportunities/${opp.id}`}><Button size="sm" iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}>Open full page</Button></Link>}
          {!compact && <Link to={`/match?opp=${opp.id}`}><Button icon={<Sparkles className="h-4 w-4" />}>Find researchers</Button></Link>}
          {!compact && <Link to={`/opportunities/${opp.id}/brief`}><Button icon={<Printer className="h-4 w-4" />}>Opportunity brief</Button></Link>}
          <Menu trigger={<Button variant={compact ? 'secondary' : 'primary'} size={compact ? 'sm' : 'md'} icon={<Plus className="h-4 w-4" />}>Record</Button>}>
            <MenuLabel>Record activity</MenuLabel>
            <MenuItem icon={<NotebookPen />} onSelect={() => logIt('note')}>Note</MenuItem>
            <MenuItem icon={<Phone />} onSelect={() => logIt('call')}>Call</MenuItem>
            <MenuItem icon={<ClipboardCheck />} onSelect={() => logIt('meeting')}>Meeting</MenuItem>
            <MenuItem icon={<Send />} onSelect={() => logIt('email-logged')}>Email (sent outside this system)</MenuItem>
            <MenuSep />
            <MenuItem icon={<CalendarPlus />} onSelect={scheduleFollowUp}>Schedule follow-up</MenuItem>
            <MenuItem icon={<Flag />} onSelect={addOutcome}>Outcome</MenuItem>
          </Menu>
          <Menu trigger={<Button variant="ghost" size={compact ? 'icon-sm' : 'icon'} aria-label="Move stage"><MoreHorizontal className="h-4 w-4" /></Button>}>
            <MenuLabel>Move to stage</MenuLabel>
            {type.stages.map((s: Stage) => <MenuItem key={s} disabled={s === opp.stage} onSelect={() => moveWithChecks(opp.id, s, navigate)}>{stageLabel(s)}</MenuItem>)}
          </Menu>
        </div>
      </div>

      <StageStepper opp={opp} />
      {opp.stage === 'intro-prepared' && <InfoNote tone="accent" icon={<ShieldCheck />}>An introduction draft exists. <b>Nothing has been sent.</b> Copy it into your own email, send it yourself, then record it below.</InfoNote>}
      {opp.stage === 'closed' && opp.closeReason && <InfoNote icon={<Flag />}><b>Closed:</b> {opp.closeReason}</InfoNote>}

      <div className={cn('grid grid-cols-1 gap-5', !compact && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="space-y-5 min-w-0">
          <section className="panel p-5">
            <div className="eyebrow mb-1.5">Description</div>
            <p className="text-md text-ink-2 leading-relaxed">{opp.description}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField label="Next action" value={opp.nextAction ?? ''} placeholder="What should happen next?" onSave={(v) => updateOpportunity(opp.id, { nextAction: v || undefined })} />
              <div>
                <div className="text-xs text-ink-3">Follow-up</div>
                <div className="mt-1 flex items-center gap-2"><DueBadge iso={opp.followUp} />{!opp.followUp && <span className="text-sm text-ink-4">None</span>}<Button size="xs" variant="ghost" onClick={scheduleFollowUp}>Schedule</Button></div>
              </div>
            </div>
          </section>

          <ResearchersSection opp={opp} matchFor={matchFor} />

          {(type.stages.includes('intro-prepared')) && <IntroSection opp={opp} drafts={drafts} matchFor={matchFor} />}

          {opp.outcomes.length > 0 && (
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Outcomes</span><Button size="xs" variant="ghost" onClick={addOutcome}>Add</Button></div>
              <ul className="divide-y divide-line">
                {opp.outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-3 px-5 py-3">
                    <Badge tone={OUTCOME_LABELS[o.kind].success ? 'good' : OUTCOME_LABELS[o.kind].success === false ? 'bad' : 'neutral'}>{OUTCOME_LABELS[o.kind].label}</Badge>
                    <div className="min-w-0 flex-1 text-sm">
                      {o.note && <p className="text-ink-2">{o.note}</p>}
                      <p className="mt-0.5 text-xs text-ink-3"><UserName id={o.recordedBy} /> · {fmtDate(o.recordedAt)}{o.facultyId && <> · {db.faculty[o.facultyId]?.name}</>}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <div className="panel-head"><span className="panel-title">Activity</span><Button size="xs" variant="ghost" icon={<NotebookPen className="h-3.5 w-3.5" />} onClick={() => logIt('note')}>Add note</Button></div>
            <div className="p-5">
              {opp.notes.length > 0 && (
                <div className="mb-5 space-y-2">
                  {opp.notes.map((n) => <div key={n.id} className="rounded-md bg-warn-soft/50 px-3 py-2 text-sm ring-1 ring-warn/15"><p className="text-ink-2">{n.text}</p><p className="mt-0.5 text-xs text-ink-3"><UserName id={n.authorId} /> · {relTime(n.at)}</p></div>)}
                </div>
              )}
              <ActivityFeed items={activities} showContext={false} empty="No activity recorded yet." />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel p-5 text-sm">
            <dl className="space-y-3">
              <Row label="Owner">
                <Select value={opp.ownerId} onChange={(v) => updateOpportunity(opp.id, { ownerId: v }, `Owner changed to ${db.users[v].name}`)} options={Object.values(db.users).filter((u) => u.team !== 'Project Team').map((u) => ({ value: u.id, label: u.name }))} className="h-8" aria-label="Owner" />
              </Row>
              <Row label="Priority">
                <Select value={opp.priority} onChange={(v) => updateOpportunity(opp.id, { priority: v })} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} className="h-8" aria-label="Priority" />
              </Row>
              <Row label="Company interest">{interest ? <span className="text-ink">{interest.title}</span> : <span className="text-ink-4">Not linked</span>}</Row>
              <Row label="Workflow">{type.label} · {type.stages.length} stages</Row>
              <Row label="In current stage">{daysSince(opp.stageEnteredAt)} days</Row>
              <Row label="Created">{fmtDate(opp.createdAt)}</Row>
              <Row label="Estimated value">
                {opp.estimatedValue ? <Tip content={opp.estimatedValue.basis}><span className="underline decoration-dotted underline-offset-2">{money(opp.estimatedValue.amount)}</span></Tip> : <span className="text-ink-4">Not estimated</span>}
              </Row>
              {search && <Row label="Match search"><Link className="link" to={`/match/${search.id}`}>{search.title}</Link></Row>}
            </dl>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="panel-title">Follow-ups</span><Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={scheduleFollowUp}>Add</Button></div>
            <ul className="divide-y divide-line">
              {tasks.length === 0 && <li className="px-5 py-4 text-sm text-ink-3">No follow-ups scheduled.</li>}
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5 px-5 py-2.5">
                  <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} />
                  <div className="min-w-0 flex-1"><div className={cn('text-sm', t.done ? 'text-ink-4 line-through' : 'text-ink')}>{t.title}</div><div className="mt-0.5 flex items-center gap-2"><DueBadge iso={t.due} done={t.done} /><span className="text-xs text-ink-4">{db.users[t.ownerId]?.name}</span></div></div>
                </li>
              ))}
            </ul>
          </section>

          {signals.length > 0 && (
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Related signals</span></div>
              <ul className="divide-y divide-line">{signals.map((s) => <li key={s.id} className="px-5 py-2.5"><Link to={`/signals?item=${s.id}`} className="flex gap-2 text-sm text-ink hover:text-accent"><Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-4" />{s.title}</Link></li>)}</ul>
            </section>
          )}
          {!compact && reviews.length > 0 && (
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Reviews</span></div>
              <ul className="divide-y divide-line">{reviews.map((r) => <li key={r.id} className="px-5 py-2.5"><Link to={`/review?item=${r.id}`} className="text-sm text-ink hover:text-accent">{r.title}</Link><div className="text-xs text-ink-3 capitalize">{r.status.replace('-', ' ')} · {relTime(r.decidedAt ?? r.createdAt)}</div></li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[120px_1fr] items-center gap-2"><dt className="text-ink-3">{label}</dt><dd className="min-w-0 text-ink-2">{children}</dd></div>;
}

function EditableField({ label, value, onSave, placeholder }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="block">
      <span className="text-xs text-ink-3">{label}</span>
      <input className="input mt-1 h-8" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
}

function ResearchersSection({ opp, matchFor }: { opp: Opportunity; matchFor: (fid: string) => ReturnType<typeof runBaseline>['results'][number] | undefined }) {
  const db = useDb();
  const [editing, setEditing] = useState(false);
  const research = TYPE_BY_ID[opp.type].pathway !== 'engagement';
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Researchers <span className="font-normal text-ink-4">{opp.facultyIds.length}</span></span>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</Button>
          <Link to={`/match?opp=${opp.id}`}><Button size="xs" variant="ghost" icon={<Sparkles className="h-3.5 w-3.5" />}>Find more</Button></Link>
        </div>
      </div>
      {editing && <div className="border-b border-line px-5 py-3"><FacultyPicker value={opp.facultyIds} onChange={(ids) => updateOpportunity(opp.id, { facultyIds: ids })} /></div>}
      {opp.facultyIds.length === 0 ? (
        <EmptyState className="py-8" title="No researchers linked" action={<Link to={`/match?opp=${opp.id}`}><Button variant="primary" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Run a match for this opportunity</Button></Link>}>
          {research ? 'Use Match Studio to find candidates with evidence.' : 'Engagement opportunities may not need faculty.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {opp.facultyIds.map((fid) => {
            const f = db.faculty[fid];
            const review = Object.values(db.reviews).filter((r) => r.opportunityId === opp.id && r.facultyId === fid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const draft = Object.values(db.drafts).find((d) => d.opportunityId === opp.id && d.facultyId === fid);
            const m = matchFor(fid);
            return (
              <li key={fid} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={f.name} size={32} />
                <div className="min-w-0 flex-1">
                  <Link to={`/faculty/${fid}`} className="text-sm font-medium text-ink hover:text-accent">{f.name}</Link>
                  <div className="text-xs text-ink-3">{db.departments[f.departmentId]?.name}{m && <> · match {m.score}/100 · {m.confidence.level} evidence</>}</div>
                </div>
                {review
                  ? <Link to={`/review?item=${review.id}`}><Badge tone={review.status === 'approved' ? 'good' : review.status === 'rejected' ? 'bad' : 'warn'} icon={<ClipboardCheck className="h-3 w-3" />}>Review {review.status.replace('-', ' ')}</Badge></Link>
                  : research && <Button size="xs" icon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => requestReview(opp.id, [fid], m ? { [fid]: m } : {})}>Send to review</Button>}
                {draft && <Badge tone={draft.status === 'recorded-sent' ? 'accent' : 'outline'} icon={<FileText className="h-3 w-3" />}>{draft.status === 'recorded-sent' ? 'Intro recorded' : 'Draft — not sent'}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function IntroSection({ opp, drafts, matchFor }: { opp: Opportunity; drafts: IntroDraft[]; matchFor: (fid: string) => ReturnType<typeof runBaseline>['results'][number] | undefined }) {
  const db = useDb();
  const approved = Object.values(db.reviews).filter((r) => r.opportunityId === opp.id && r.status === 'approved' && (r.kind === 'match' || r.kind === 'introduction'));
  const eligible = opp.facultyIds.filter((fid) => approved.some((r) => !r.facultyId || r.facultyId === fid) && !drafts.some((d) => d.facultyId === fid));
  useEffect(() => { if (window.location.hash === '#intro') document.getElementById('intro')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);
  return (
    <section id="intro" className="panel scroll-mt-4">
      <div className="panel-head">
        <span className="panel-title">Introductions</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="h-3.5 w-3.5 text-good" />Drafted here, sent by you</span>
      </div>
      <div className="p-5 space-y-4">
        {drafts.length === 0 && eligible.length === 0 && (
          <InfoNote icon={<ClipboardCheck />}>
            {approved.length === 0 ? 'Introductions can be drafted only after a reviewer approves a researcher for this opportunity.' : 'All approved researchers already have drafts.'}
          </InfoNote>
        )}
        {eligible.map((fid) => (
          <div key={fid} className="flex flex-wrap items-center gap-3 rounded-md bg-good-soft/50 px-4 py-3 ring-1 ring-good/20">
            <CheckCircle2 className="h-4 w-4 text-good" />
            <span className="flex-1 text-sm text-ink-2"><b className="font-medium text-ink">{db.faculty[fid].name}</b> was approved for introduction.</span>
            <Button size="sm" variant="primary" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => createDraft(opp.id, fid, matchFor(fid))}>Prepare draft</Button>
          </div>
        ))}
        {drafts.map((d) => <DraftEditor key={d.id} d={d} />)}
      </div>
    </section>
  );
}

function DraftEditor({ d }: { d: IntroDraft }) {
  const db = useDb();
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body);
  const dirty = subject !== d.subject || body !== d.body;
  const sent = d.status === 'recorded-sent';
  const f = db.faculty[d.facultyId];
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success('Copied — paste it into your own email'); }
    catch { toast.error('Clipboard unavailable. Select the text and copy manually.'); }
  };
  const record = async () => {
    const channel = await ask({
      title: 'Record introduction as sent', confirmLabel: 'Record as sent',
      body: <>Only do this after <b>you</b> have sent it. This system has not sent anything and cannot.</>,
      input: { label: 'How was it sent?', required: true, placeholder: 'e.g. Email from my university Outlook', initial: 'Email from my university account' },
    });
    if (channel) recordSent(d.id, channel);
  };
  const words = useMemo(() => body.trim().split(/\s+/).length, [body]);
  return (
    <div className="rounded-lg ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/70 px-4 py-2.5">
        <Avatar name={f.name} size={22} />
        <span className="text-sm font-medium text-ink">To {f.name}</span>
        <span className={cn('text-xs', f.emailVerified ? 'text-ink-3' : 'text-warn')}>{f.email ?? 'no email'}{f.emailVerified ? '' : ' (unverified)'}</span>
        <span className="ml-auto">{sent ? <Badge tone="accent" icon={<Send className="h-3 w-3" />}>Recorded as sent</Badge> : <Badge tone="warn" dot>Draft — not sent</Badge>}</span>
      </div>
      <div className="p-4 space-y-2">
        <input className="input font-medium" value={subject} disabled={sent} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
        <textarea className="input font-sans text-sm leading-relaxed" rows={sent ? 4 : 13} value={body} disabled={sent} onChange={(e) => setBody(e.target.value)} aria-label="Body" />
        <div className="text-2xs text-ink-4">Template draft generated from the match evidence · {words} words · edit freely</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        {sent ? (
          <span className="text-xs text-ink-3">Recorded by <UserName id={d.recordedBy} /> on {fmtDate(d.recordedAt)} · {d.recordedChannel}</span>
        ) : (
          <>
            <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={copy}>Copy</Button>
            <Button size="sm" disabled={!dirty} onClick={() => saveDraft(d.id, { subject, body })}>Save draft</Button>
            <span className="text-xs text-ink-3">Last saved {relTime(d.updatedAt)}</span>
            <Button size="sm" variant="primary" className="ml-auto" icon={<Send className="h-3.5 w-3.5" />} onClick={record} disabled={dirty}>I sent it — record</Button>
          </>
        )}
      </div>
    </div>
  );
}
