import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Globe, MapPin, Pencil, Plus, Sparkles } from 'lucide-react';
import { runBaseline } from '@shared/matching/baseline';
import { STAGES, TYPE_BY_ID } from '@shared/rules';
import type { CompanyInterest, Pathway } from '@shared/types';
import { useDb, useMe } from '@/lib/store';
import { canEdit } from '@shared/roles';
import { CompanyEditDialog } from '@/components/forms/RecordForms';
import { useUI } from '@/lib/ui';
import { fmtDate, relTime } from '@/lib/format';
import { corpusOf } from '@/lib/corpus';
import { addCompanyNote, addTask, logActivity, updateCompany, upsertInterest } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Field, Segmented, Select, Tabs } from '@/components/ui/primitives';
import { Dialog, Menu, MenuItem, ask } from '@/components/ui/overlays';
import { ActivityFeed, CompanyMark, DueBadge, InfoNote, PATHWAY_META, ScoreDial, SourceLine, StageBadge, TypeBadge, UserName } from '@/components/domain';
import { TopicChips, TopicPicker } from '@/components/forms/Pickers';
import { REL_META } from './CompaniesPage';

type Tab = 'overview' | 'needs' | 'matches' | 'opportunities' | 'relationships' | 'activity' | 'notes';

export function CompanyProfile() {
  const { id } = useParams();
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const openNewOpp = useUI((s) => s.openNewOpp);
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const [editInterest, setEditInterest] = useState<Partial<CompanyInterest> | null>(null);
  const [editingCo, setEditingCo] = useState(false);
  const me = useMe();
  const c = id ? db.companies[id] : undefined;

  const interests = useMemo(() => Object.values(db.interests).filter((i) => i.companyId === id).sort((a, b) => a.status.localeCompare(b.status)), [db, id]);
  const opps = Object.values(db.opportunities).filter((o) => o.companyId === id);
  const rels = Object.values(db.relationships).filter((r) => r.companyId === id);
  const acts = Object.values(db.activities).filter((a) => a.companyId === id);
  const tasks = Object.values(db.tasks).filter((t) => t.companyId === id && !t.done);
  const signals = Object.values(db.signals).filter((s) => id && s.companyIds.includes(id));

  const matches = useMemo(() => {
    const corpus = corpusOf(db);
    return interests.filter((i) => i.status !== 'fulfilled').map((i) => ({
      interest: i,
      results: runBaseline({ text: `${i.title}. ${i.description}`, topics: i.topics, engagementType: i.pathway === 'talent' ? 'talent' : i.pathway === 'engagement' ? 'engagement' : 'research', disciplines: [], constraints: {} }, corpus).results.slice(0, 4),
    }));
  }, [db, interests]);

  if (!c) return <Page><EmptyState title="Company not found" action={<Link to="/companies" className="link">Back to companies</Link>} /></Page>;

  const suggested: { pathway: Pathway; why: string }[] = [];
  if (interests.some((i) => i.pathway === 'research' && i.status === 'open')) suggested.push({ pathway: 'research', why: 'Open research needs with strong faculty matches.' });
  if (interests.some((i) => i.pathway === 'talent') || c.size === 'enterprise') suggested.push({ pathway: 'talent', why: c.size === 'enterprise' ? 'Large employer; recruiting partnerships are a natural entry point.' : 'Has stated recruiting interests.' });
  if (!rels.some((r) => r.kind === 'event') && c.relationship !== 'former') suggested.push({ pathway: 'engagement', why: 'No campus visibility activity recorded yet.' });

  const note = async () => { const t = await ask({ title: `Note on ${c.name}`, confirmLabel: 'Save', input: { label: 'Note', multiline: true, required: true } }); if (t) addCompanyNote(c.id, t); };
  const followUp = async () => {
    const title = await ask({ title: 'Schedule follow-up', confirmLabel: 'Next', input: { label: 'Task', required: true } }); if (!title) return;
    const date = await ask({ title: 'Due date', confirmLabel: 'Schedule', input: { label: 'YYYY-MM-DD', required: true, initial: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) } });
    if (date && !isNaN(Date.parse(date))) addTask({ title, due: new Date(date + 'T12:00:00').toISOString(), companyId: c.id });
  };

  return (
    <Page wide>
      <PageHeader
        crumbs={[{ label: 'Companies', to: '/companies' }, { label: c.industry }]}
        title={<span className="flex items-center gap-4"><CompanyMark name={c.name} size={48} />{c.name}</span>}
        description={c.description}
        meta={<>
          <Badge tone={REL_META[c.relationship].tone} dot>{REL_META[c.relationship].label} relationship</Badge>
          <Badge tone="outline" className="capitalize">{c.size}</Badge>
          {c.hq && <span className="flex items-center gap-1 text-xs text-ink-3"><MapPin className="h-3.5 w-3.5" />{c.hq}</span>}
          {c.website && <span className="flex items-center gap-1 text-xs text-ink-3"><Globe className="h-3.5 w-3.5" />{c.website}</span>}
          <span className="text-xs text-ink-3">Owner: <UserName id={c.ownerId} /></span>
        </>}
        actions={<>
          {canEdit(me) && <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditingCo(true)}>Edit</Button>}
          <Menu trigger={<Button icon={<Plus className="h-4 w-4" />}>Record</Button>}>
            <MenuItem onSelect={note}>Note</MenuItem>
            <MenuItem onSelect={async () => { const t = await ask({ title: 'Log meeting', confirmLabel: 'Save', input: { label: 'Summary', multiline: true, required: true } }); if (t) logActivity('meeting', t, { companyId: c.id }); }}>Meeting</MenuItem>
            <MenuItem onSelect={async () => { const t = await ask({ title: 'Log call', confirmLabel: 'Save', input: { label: 'Summary', multiline: true, required: true } }); if (t) logActivity('call', t, { companyId: c.id }); }}>Call</MenuItem>
            <MenuItem onSelect={followUp}>Follow-up task</MenuItem>
          </Menu>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openNewOpp({ companyId: c.id })}>New opportunity</Button>
        </>}
      />

      <Tabs className="mb-6" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} tabs={[
        { value: 'overview', label: 'Overview' }, { value: 'needs', label: 'Research & talent needs', count: interests.length }, { value: 'matches', label: 'Faculty matches' },
        { value: 'opportunities', label: 'Opportunities', count: opps.length }, { value: 'relationships', label: 'Relationships', count: rels.length }, { value: 'activity', label: 'Activity', count: acts.length }, { value: 'notes', label: 'Notes', count: c.notes.length },
      ]} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="panel p-5">
              <div className="eyebrow mb-2">Engagement objectives</div>
              <ul className="space-y-1.5 text-md text-ink-2">{c.objectives.map((o) => <li key={o} className="flex gap-2"><span className="text-accent">→</span>{o}</li>)}{!c.objectives.length && <li className="text-sm text-ink-3">None recorded.</li>}</ul>
            </section>
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Suggested engagement pathways</span><span className="text-xs text-ink-3">Rule-based suggestions</span></div>
              <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
                {(['research', 'talent', 'engagement'] as const).map((p) => {
                  const s = suggested.find((x) => x.pathway === p);
                  const n = interests.filter((i) => i.pathway === p).length;
                  return (
                    <div key={p} className={s ? 'rounded-md p-4 ring-1 ring-accent-line bg-accent-soft/30' : 'rounded-md p-4 ring-1 ring-line'}>
                      <Badge tone={PATHWAY_META[p].tone}>{PATHWAY_META[p].label}</Badge>
                      <p className="mt-2 text-sm text-ink-2">{s?.why ?? 'No current signal for this pathway.'}</p>
                      <p className="mt-1 text-xs text-ink-3">{n} recorded need{n === 1 ? '' : 's'}</p>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Open opportunities</span><button className="text-xs text-accent hover:underline" onClick={() => setParams({ tab: 'opportunities' })}>All</button></div>
              <OppList opps={opps.filter((o) => o.stage !== 'closed' && o.stage !== 'outcome')} />
            </section>
          </div>
          <aside className="space-y-5">
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Follow-ups</span><Button size="xs" variant="ghost" onClick={followUp}>Add</Button></div>
              <ul className="divide-y divide-line">{tasks.map((t) => <li key={t.id} className="px-4 py-2.5"><div className="text-sm text-ink">{t.title}</div><DueBadge iso={t.due} /></li>)}{!tasks.length && <li className="px-4 py-4 text-sm text-ink-3">None scheduled.</li>}</ul>
            </section>
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Signals</span></div>
              <ul className="divide-y divide-line">{signals.map((s) => <li key={s.id}><Link className="block px-4 py-2.5 hover:bg-subtle/70" to={`/signals?item=${s.id}`}><div className="text-sm text-ink">{s.title}</div><div className="text-xs text-ink-3">{relTime(s.date)} · {s.status}</div></Link></li>)}{!signals.length && <li className="px-4 py-4 text-sm text-ink-3">No signals.</li>}</ul>
            </section>
            <section className="panel p-4">
              <div className="eyebrow mb-2">Owner</div>
              <Select value={c.ownerId ?? ''} onChange={(v) => updateCompany(c.id, { ownerId: v || undefined })} placeholder="Unassigned" options={Object.values(db.users).filter((u) => u.team !== 'Project Team').map((u) => ({ value: u.id, label: u.name }))} />
              <div className="eyebrow mb-2 mt-4">Relationship status</div>
              <Select value={c.relationship} onChange={(v) => updateCompany(c.id, { relationship: v })} options={(['prospect', 'active', 'dormant', 'former'] as const).map((r) => ({ value: r, label: REL_META[r].label }))} />
              <div className="mt-4 space-y-1">{c.sources.map((s, i) => <SourceLine key={i} source={s} />)}</div>
            </section>
          </aside>
        </div>
      )}

      {tab === 'needs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-3">Each need is a separate record, so one company can pursue research, recruiting and visibility at the same time.</p>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditInterest({ companyId: c.id, pathway: 'research', topics: [], status: 'open' })}>Add need</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {interests.map((i) => (
              <div key={i.id} className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><Badge tone={PATHWAY_META[i.pathway].tone}>{PATHWAY_META[i.pathway].label}</Badge><h3 className="mt-2 text-md font-semibold text-ink">{i.title}</h3></div>
                  <div className="flex items-center gap-1"><Badge tone={i.status === 'open' ? 'good' : i.status === 'fulfilled' ? 'neutral' : 'warn'} className="capitalize">{i.status}</Badge><Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditInterest(i)}><Pencil className="h-3.5 w-3.5" /></Button></div>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{i.description}</p>
                <div className="mt-3"><TopicChips ids={i.topics} /></div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/match?interest=${i.id}`}><Button size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>Find faculty</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => openNewOpp({ companyId: c.id, interestId: i.id, title: i.title, description: i.description, type: i.pathway === 'talent' ? 'recruiting' : i.pathway === 'engagement' ? 'event-sponsorship' : 'sponsored-research' })}>Create opportunity</Button>
                </div>
              </div>
            ))}
            {!interests.length && <div className="panel lg:col-span-2"><EmptyState title="No needs recorded" action={<Button onClick={() => setEditInterest({ companyId: c.id, pathway: 'research', topics: [], status: 'open' })}>Add the first need</Button>}>Record what the company wants — a research topic, a hiring goal, or campus visibility.</EmptyState></div>}
          </div>
        </div>
      )}

      {tab === 'matches' && (
        <div className="space-y-5">
          <InfoNote>Top researchers for each open need, computed live by the baseline matcher. Open a need in Match Studio to inspect evidence, compare and shortlist.</InfoNote>
          {matches.map(({ interest, results }) => (
            <section key={interest.id} className="panel">
              <div className="panel-head"><span className="panel-title">{interest.title}</span><Link to={`/match?interest=${interest.id}`}><Button size="xs" variant="ghost" icon={<Sparkles className="h-3.5 w-3.5" />}>Open in Match Studio</Button></Link></div>
              <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0">
                {results.map((r) => (
                  <li key={r.facultyId} className="flex items-center gap-3 px-5 py-3 md:border-b md:border-line">
                    <ScoreDial score={r.score} band={r.band} size={36} />
                    <div className="min-w-0"><Link to={`/faculty/${r.facultyId}`} className="text-sm font-medium text-ink hover:text-accent">{db.faculty[r.facultyId]?.name}</Link><div className="truncate text-xs text-ink-3">{r.summary}</div></div>
                  </li>
                ))}
                {!results.length && <li className="px-5 py-4 text-sm text-ink-3">No researchers above the relevance threshold.</li>}
              </ul>
            </section>
          ))}
          {!matches.length && <div className="panel"><EmptyState title="No open needs to match">Add a research or talent need first.</EmptyState></div>}
        </div>
      )}

      {tab === 'opportunities' && <section className="panel"><OppList opps={opps} /></section>}

      {tab === 'relationships' && (
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Known university relationships</span><span className="text-xs text-ink-3">Shown only from authorized records</span></div>
          <ul className="divide-y divide-line">
            {rels.map((r) => (
              <li key={r.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-ink">{r.title}</span><Badge tone="outline" className="capitalize">{r.kind.replace('-', ' ')}</Badge><Badge tone={r.status === 'active' ? 'good' : 'neutral'} className="capitalize">{r.status}</Badge></div>
                <p className="mt-0.5 text-sm text-ink-2">{r.description}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-3">
                  <span>{fmtDate(r.since, 'MMM yyyy')} – {r.until ? fmtDate(r.until, 'MMM yyyy') : 'present'}</span>
                  {r.facultyIds.length > 0 && <span>Faculty: {r.facultyIds.map((f) => <Link key={f} to={`/faculty/${f}`} className="hover:text-accent">{db.faculty[f]?.name}</Link>)}</span>}
                  {r.departmentIds.length > 0 && <span>{r.departmentIds.map((d) => db.departments[d]?.name).join(', ')}</span>}
                </div>
                <SourceLine source={r.source} className="mt-1" />
              </li>
            ))}
            {!rels.length && <li className="px-5 py-8 text-center text-sm text-ink-3">No relationships on record. That may mean none exist — or that the records aren’t connected yet.</li>}
          </ul>
        </section>
      )}

      {tab === 'activity' && <section className="panel p-5"><ActivityFeed items={acts} /></section>}

      {tab === 'notes' && (
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Internal notes</span><Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={note}>Add note</Button></div>
          <ul className="divide-y divide-line">
            {c.notes.map((n) => <li key={n.id} className="flex gap-3 px-5 py-3.5"><Avatar name={db.users[n.authorId]?.name ?? '?'} size={26} /><div><p className="text-sm text-ink-2">{n.text}</p><p className="mt-0.5 text-xs text-ink-3"><UserName id={n.authorId} /> · {relTime(n.at)}</p></div></li>)}
            {!c.notes.length && <li className="px-5 py-8 text-center text-sm text-ink-3">No notes yet.</li>}
          </ul>
        </section>
      )}

      <InterestDialog value={editInterest} onClose={() => setEditInterest(null)} />
      <CompanyEditDialog open={editingCo} company={c} onClose={() => setEditingCo(false)} />
    </Page>
  );
}

function OppList({ opps }: { opps: import('@shared/types').Opportunity[] }) {
  return (
    <ul className="divide-y divide-line">
      {opps.map((o) => (
        <li key={o.id}>
          <Link to={`/opportunities/${o.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-subtle/70">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium text-ink">{o.title}</div><div className="text-xs text-ink-3">{TYPE_BY_ID[o.type].label} · stage {STAGES.findIndex((s) => s.id === o.stage) + 1} of {TYPE_BY_ID[o.type].stages.length}</div></div>
            <TypeBadge type={o.type} /><StageBadge stage={o.stage} /><DueBadge iso={o.stage === 'closed' || o.stage === 'outcome' ? undefined : o.followUp} />
          </Link>
        </li>
      ))}
      {!opps.length && <li className="px-5 py-6 text-center text-sm text-ink-3">No opportunities.</li>}
    </ul>
  );
}

function InterestDialog({ value, onClose }: { value: Partial<CompanyInterest> | null; onClose: () => void }) {
  const [v, setV] = useState<Partial<CompanyInterest>>({});
  const [err, setErr] = useState('');
  const open = !!value;
  useEffect(() => { if (value) setV(value); }, [value]);
  const save = async () => {
    if (!v.title || v.title.trim().length < 3) { setErr('Give the need a short title.'); return; }
    await upsertInterest({ ...v, title: v.title.trim(), companyId: v.companyId!, pathway: v.pathway ?? 'research' } as CompanyInterest);
    setErr(''); setV({}); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setV({}); onClose(); } }} title={value?.id ? 'Edit need' : 'Add a company need'}
      footer={<><Button variant="ghost" onClick={() => { setV({}); onClose(); }}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Pathway"><Segmented value={v.pathway ?? 'research'} onChange={(p) => setV({ ...v, pathway: p })} options={(['research', 'talent', 'engagement'] as const).map((p) => ({ value: p, label: PATHWAY_META[p].label }))} /></Field>
        <Field label="Title" required error={err}><input className="input" autoFocus value={v.title ?? ''} aria-invalid={!!err} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows={3} value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Topics"><div className="flex flex-wrap items-center gap-1"><TopicChips ids={v.topics ?? []} onRemove={(t) => setV({ ...v, topics: (v.topics ?? []).filter((x) => x !== t) })} /><TopicPicker size="sm" value={v.topics ?? []} onChange={(t) => setV({ ...v, topics: t })} /></div></Field>
        <Field label="Status"><Select value={v.status ?? 'open'} onChange={(s) => setV({ ...v, status: s })} options={[{ value: 'open', label: 'Open' }, { value: 'exploring', label: 'Exploring' }, { value: 'paused', label: 'Paused' }, { value: 'fulfilled', label: 'Fulfilled' }]} /></Field>
      </div>
    </Dialog>
  );
}
